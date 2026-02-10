import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  channelDailySuperchatRollups,
  sourceAccounts,
  liveStreams,
  monetizationEvents,
} from '@/lib/db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

const MICROS_PER_DOLLAR = 1_000_000;

/** GET /api/live/channel/[id]/today — today's gross + last 60m + last event for a channel */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sourceAccountId } = await params;
    const today = new Date().toISOString().slice(0, 10);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const channel = await db.query.sourceAccounts.findFirst({
      where: eq(sourceAccounts.id, sourceAccountId),
      columns: { id: true, displayName: true, handle: true },
    });
    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    const dayRow = await db.query.channelDailySuperchatRollups.findFirst({
      where: and(
        eq(channelDailySuperchatRollups.sourceAccountId, sourceAccountId),
        eq(channelDailySuperchatRollups.date, today)
      ),
    });

    const lastHourRow = await db
      .select({ sum: sql<number>`COALESCE(SUM(amount_micros), 0)` })
      .from(monetizationEvents)
      .where(
        and(
          eq(monetizationEvents.sourceAccountId, sourceAccountId),
          gte(monetizationEvents.publishedAt, oneHourAgo)
        )
      );
    const last60MinGrossMicros = Number(lastHourRow[0]?.sum ?? 0);

    const lastEvent = await db.query.monetizationEvents.findFirst({
      where: eq(monetizationEvents.sourceAccountId, sourceAccountId),
      orderBy: desc(monetizationEvents.publishedAt),
      columns: { amountMicros: true, currency: true, publishedAt: true, type: true },
    });

    const currentLive = await db.query.liveStreams.findFirst({
      where: and(
        eq(liveStreams.sourceAccountId, sourceAccountId),
        eq(liveStreams.status, 'live')
      ),
      columns: { videoId: true, title: true, startedAt: true },
    });

    return NextResponse.json({
      sourceAccountId,
      displayName: channel.displayName || channel.handle,
      date: today,
      todayGrossUsd: dayRow ? dayRow.grossAmountMicros / MICROS_PER_DOLLAR : 0,
      todayGrossMicros: dayRow?.grossAmountMicros ?? 0,
      todayEventCount: dayRow?.eventCount ?? 0,
      todayBreakdown: (dayRow?.breakdown as Record<string, { micros: number; count: number }>) ?? {},
      last60MinGrossUsd: last60MinGrossMicros / MICROS_PER_DOLLAR,
      last60MinGrossMicros: last60MinGrossMicros,
      lastEvent: lastEvent
        ? {
            amountMicros: lastEvent.amountMicros,
            amountUsd: lastEvent.amountMicros / MICROS_PER_DOLLAR,
            currency: lastEvent.currency,
            type: lastEvent.type,
            publishedAt: lastEvent.publishedAt,
          }
        : null,
      liveNow: currentLive
        ? {
            videoId: currentLive.videoId,
            url: `https://www.youtube.com/watch?v=${currentLive.videoId}`,
            title: currentLive.title,
            startedAt: currentLive.startedAt,
          }
        : null,
    });
  } catch (e) {
    console.error('Channel today error:', e);
    return NextResponse.json({ error: 'Failed to load channel' }, { status: 500 });
  }
}
