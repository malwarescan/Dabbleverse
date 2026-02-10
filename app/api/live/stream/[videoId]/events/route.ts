import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { monetizationEvents, streamSuperchatRollups, sourceAccounts } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

const MICROS_PER_DOLLAR = 1_000_000;

/** GET /api/live/stream/[videoId]/events — events + rollup for a stream */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;

    const rollup = await db.query.streamSuperchatRollups.findFirst({
      where: eq(streamSuperchatRollups.videoId, videoId),
    });

    const events = await db
      .select({
        id: monetizationEvents.id,
        type: monetizationEvents.type,
        amountMicros: monetizationEvents.amountMicros,
        currency: monetizationEvents.currency,
        publishedAt: monetizationEvents.publishedAt,
        authorChannelId: monetizationEvents.authorChannelId,
      })
      .from(monetizationEvents)
      .where(eq(monetizationEvents.videoId, videoId))
      .orderBy(desc(monetizationEvents.publishedAt))
      .limit(100);

    const withChannel = rollup
      ? await db.query.sourceAccounts.findFirst({
          where: eq(sourceAccounts.id, rollup.sourceAccountId),
          columns: { displayName: true, handle: true },
        })
      : null;

    return NextResponse.json({
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      grossUsd: rollup ? rollup.grossAmountMicros / MICROS_PER_DOLLAR : 0,
      grossAmountMicros: rollup?.grossAmountMicros ?? 0,
      eventCount: rollup?.eventCount ?? 0,
      breakdown: (rollup?.breakdown as Record<string, { micros: number; count: number }>) ?? {},
      displayName: withChannel?.displayName || withChannel?.handle,
      events: events.map((e) => ({
        type: e.type,
        amountUsd: e.amountMicros / MICROS_PER_DOLLAR,
        amountMicros: e.amountMicros,
        currency: e.currency,
        publishedAt: e.publishedAt,
      })),
    });
  } catch (e) {
    console.error('Stream events error:', e);
    return NextResponse.json({ error: 'Failed to load stream' }, { status: 500 });
  }
}
