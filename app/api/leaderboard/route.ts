import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboardChannelsForScoreboard } from '@/app/api/live/leaderboard/route';
import { db } from '@/lib/db';
import { channelDailySuperchatRollups, sourceAccounts, liveStreams } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const MICROS_PER_DOLLAR = 1_000_000;

/**
 * Unified leaderboard: GET /api/leaderboard?window=today|60m
 * Public pipeline — "Super Chat Gross (Observed)".
 * Same data as /api/live/leaderboard; this is the canonical Playboard++ endpoint.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const window = searchParams.get('window') || 'today';

  try {
    const today = new Date().toISOString().slice(0, 10);
    const channels = await getLeaderboardChannelsForScoreboard();

    if (window === '60m') {
      const since = new Date(Date.now() - 60 * 60 * 1000);
      const rollups = await db
        .select({
          sourceAccountId: channelDailySuperchatRollups.sourceAccountId,
          grossAmountMicros: channelDailySuperchatRollups.grossAmountMicros,
          eventCount: channelDailySuperchatRollups.eventCount,
          displayName: sourceAccounts.displayName,
          handle: sourceAccounts.handle,
        })
        .from(channelDailySuperchatRollups)
        .innerJoin(sourceAccounts, eq(channelDailySuperchatRollups.sourceAccountId, sourceAccounts.id))
        .where(eq(channelDailySuperchatRollups.date, today));
      // 60m: for MVP we still return today's rollup; full 60m would need raw events filtered by published_at >= since
      const list = rollups.length > 0
        ? rollups.map((r) => ({
            channelId: r.sourceAccountId,
            displayName: r.displayName || r.handle || 'Channel',
            grossUsd: r.grossAmountMicros / MICROS_PER_DOLLAR,
            eventCount: r.eventCount,
          }))
        : channels.map((c, i) => ({
            channelId: null,
            displayName: c.displayName,
            grossUsd: c.grossUsd,
            eventCount: 0,
          }));
      return NextResponse.json({
        window: '60m',
        date: today,
        channels: list.slice(0, 20),
        label: 'Observed Gross (today; 60m filter requires event-level query)',
      });
    }

    const live = await db
      .select({
        videoId: liveStreams.videoId,
        title: liveStreams.title,
        displayName: sourceAccounts.displayName,
        handle: sourceAccounts.handle,
      })
      .from(liveStreams)
      .innerJoin(sourceAccounts, eq(liveStreams.sourceAccountId, sourceAccounts.id))
      .where(eq(liveStreams.status, 'live'));

    return NextResponse.json({
      window: 'today',
      date: today,
      channels: channels.map((c) => ({
        displayName: c.displayName,
        grossUsd: c.grossUsd,
      })),
      liveNow: live.map((l) => ({
        videoId: l.videoId,
        url: `https://www.youtube.com/watch?v=${l.videoId}`,
        title: l.title,
        displayName: l.displayName || l.handle,
      })),
      label: 'Super Chat Gross (Observed)',
    });
  } catch (e) {
    console.error('Leaderboard error:', e);
    return NextResponse.json(
      { error: 'Failed to load leaderboard', channels: [], liveNow: [] },
      { status: 500 }
    );
  }
}
