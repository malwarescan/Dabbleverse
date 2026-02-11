import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { channelDailySuperchatRollups, streamSuperchatRollups, sourceAccounts, liveStreams } from '@/lib/db/schema';
import { eq, desc, notLike, like } from 'drizzle-orm';

const MICROS_PER_DOLLAR = 1_000_000;
const MAX_ROWS = 500;
/** Exclude seeded placeholder rollups (stream video_id starts with this); only worker-written rollups count as real. */
const SEED_VIDEO_PREFIX = 'seed-';

function mapChannel(r: {
  sourceAccountId: string;
  grossAmountMicros: number;
  eventCount: number;
  breakdown: unknown;
  displayName: string | null;
  handle: string | null;
}) {
  return {
    sourceAccountId: r.sourceAccountId,
    displayName: r.displayName || r.handle,
    grossUsd: r.grossAmountMicros / MICROS_PER_DOLLAR,
    grossAmountMicros: r.grossAmountMicros,
    eventCount: r.eventCount,
    breakdown: (r.breakdown as Record<string, { micros: number; count: number }>) ?? {},
  };
}

function mapStream(r: {
  videoId: string;
  sourceAccountId: string;
  grossAmountMicros: number;
  eventCount: number;
  breakdown: unknown;
  displayName: string | null;
  handle: string | null;
}) {
  return {
    videoId: r.videoId,
    url: `https://www.youtube.com/watch?v=${r.videoId}`,
    displayName: r.displayName || r.handle,
    grossUsd: r.grossAmountMicros / MICROS_PER_DOLLAR,
    grossAmountMicros: r.grossAmountMicros,
    eventCount: r.eventCount,
    breakdown: (r.breakdown as Record<string, { micros: number; count: number }>) ?? {},
  };
}

/** GET /api/live/leaderboard — all channels and all streams with profit today (real + seed) */
export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10);

    // All stream rollups: real (worker-written) + seed, merged and sorted by gross
    const realStreamRollups = await db
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
      .limit(MAX_ROWS);

    const seedStreamRollups = await db
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
      .where(like(streamSuperchatRollups.videoId, `${SEED_VIDEO_PREFIX}%`))
      .orderBy(desc(streamSuperchatRollups.grossAmountMicros))
      .limit(MAX_ROWS);

    const allStreamRollups = [...realStreamRollups, ...seedStreamRollups].sort(
      (a, b) => b.grossAmountMicros - a.grossAmountMicros
    );
    const streams = allStreamRollups.map(mapStream);

    // All channel rollups for today (real + seed)
    const channelRollups = await db
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
      .where(eq(channelDailySuperchatRollups.date, today))
      .orderBy(desc(channelDailySuperchatRollups.grossAmountMicros))
      .limit(MAX_ROWS);

    const channels = channelRollups.map(mapChannel);

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

    const liveNow = live.map((l) => ({
      videoId: l.videoId,
      url: `https://www.youtube.com/watch?v=${l.videoId}`,
      title: l.title,
      displayName: l.displayName || l.handle,
      startedAt: l.startedAt,
    }));

    const hasRealData = realStreamRollups.length > 0;

    return NextResponse.json({
      date: today,
      demo: !hasRealData,
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
