import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { channelDailySuperchatRollups, streamSuperchatRollups, sourceAccounts, liveStreams } from '@/lib/db/schema';
import { eq, desc, and, notLike, inArray } from 'drizzle-orm';

const MICROS_PER_DOLLAR = 1_000_000;
/** Exclude seeded placeholder rollups (stream video_id starts with this); only worker-written rollups count as real. */
const SEED_VIDEO_PREFIX = 'seed-';

/** GET /api/live/leaderboard — top channels by today's gross Super Chat; top streams */
export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10);

    // Stream rollups: only real (worker-written) rows, not seed placeholder rows
    const streamRollups = await db
      .select({
        videoId: streamSuperchatRollups.videoId,
        sourceAccountId: streamSuperchatRollups.sourceAccountId,
        grossAmountMicros: streamSuperchatRollups.grossAmountMicros,
        eventCount: streamSuperchatRollups.eventCount,
        breakdown: streamSuperchatRollups.breakdown,
        displayName: sourceAccounts.displayName,
        handle: sourceAccounts.handle,
      })
      .from(streamSuperchatRollups)
      .innerJoin(sourceAccounts, eq(streamSuperchatRollups.sourceAccountId, sourceAccounts.id))
      .where(notLike(streamSuperchatRollups.videoId, `${SEED_VIDEO_PREFIX}%`))
      .orderBy(desc(streamSuperchatRollups.grossAmountMicros))
      .limit(20);

    // Channel rollups: only for accounts that have at least one real (non-seed) stream, so we never show seeded demo totals as "live"
    const realAccountIds = [...new Set(streamRollups.map((r) => r.sourceAccountId))];
    const channelRollups =
      realAccountIds.length === 0
        ? []
        : await db
            .select({
              sourceAccountId: channelDailySuperchatRollups.sourceAccountId,
              grossAmountMicros: channelDailySuperchatRollups.grossAmountMicros,
              eventCount: channelDailySuperchatRollups.eventCount,
              breakdown: channelDailySuperchatRollups.breakdown,
              displayName: sourceAccounts.displayName,
              handle: sourceAccounts.handle,
            })
            .from(channelDailySuperchatRollups)
            .innerJoin(sourceAccounts, eq(channelDailySuperchatRollups.sourceAccountId, sourceAccounts.id))
            .where(
              and(
                eq(channelDailySuperchatRollups.date, today),
                inArray(channelDailySuperchatRollups.sourceAccountId, realAccountIds)
              )
            )
            .orderBy(desc(channelDailySuperchatRollups.grossAmountMicros))
            .limit(20);

    const live = await db
      .select({
        videoId: liveStreams.videoId,
        title: liveStreams.title,
        sourceAccountId: liveStreams.sourceAccountId,
        startedAt: liveStreams.startedAt,
        displayName: sourceAccounts.displayName,
        handle: sourceAccounts.handle,
      })
      .from(liveStreams)
      .innerJoin(sourceAccounts, eq(liveStreams.sourceAccountId, sourceAccounts.id))
      .where(eq(liveStreams.status, 'live'));

    const channels = channelRollups.map((r) => ({
      sourceAccountId: r.sourceAccountId,
      displayName: r.displayName || r.handle,
      grossUsd: r.grossAmountMicros / MICROS_PER_DOLLAR,
      grossAmountMicros: r.grossAmountMicros,
      eventCount: r.eventCount,
      breakdown: (r.breakdown as Record<string, { micros: number; count: number }>) ?? {},
    }));
    const streams = streamRollups.map((r) => ({
      videoId: r.videoId,
      url: `https://www.youtube.com/watch?v=${r.videoId}`,
      displayName: r.displayName || r.handle,
      grossUsd: r.grossAmountMicros / MICROS_PER_DOLLAR,
      grossAmountMicros: r.grossAmountMicros,
      eventCount: r.eventCount,
      breakdown: (r.breakdown as Record<string, { micros: number; count: number }>) ?? {},
    }));
    const liveNow = live.map((l) => ({
      videoId: l.videoId,
      url: `https://www.youtube.com/watch?v=${l.videoId}`,
      title: l.title,
      displayName: l.displayName || l.handle,
      startedAt: l.startedAt,
    }));

    const noRealData = channels.length === 0 && streams.length === 0;
    if (noRealData) {
      return NextResponse.json({
        date: today,
        demo: true,
        channels: [],
        streams: [],
        liveNow,
      });
    }
    return NextResponse.json({
      date: today,
      demo: false,
      channels,
      streams,
      liveNow,
    });
  } catch (e) {
    console.error('Live leaderboard error:', e);
    const today = new Date().toISOString().slice(0, 10);
    return NextResponse.json({ date: today, demo: true, channels: [], streams: [], liveNow: [] });
  }
}
