import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sourceAccounts, liveStreams, streamSuperchatRollups } from '@/lib/db/schema';
import { eq, and, isNotNull, notLike } from 'drizzle-orm';

/**
 * GET /api/live/status — quick debug: why is Playboard empty?
 * Returns counts so you can see if channels are resolved, worker has written live_streams / rollups.
 */
export async function GET() {
  try {
    const [channelsWithId, channelsTotal, liveCount, rollupsCount] = await Promise.all([
      db
        .select({ id: sourceAccounts.id })
        .from(sourceAccounts)
        .where(
          and(eq(sourceAccounts.platform, 'youtube'), eq(sourceAccounts.isActive, true), isNotNull(sourceAccounts.channelId))
        ),
      db
        .select({ id: sourceAccounts.id })
        .from(sourceAccounts)
        .where(and(eq(sourceAccounts.platform, 'youtube'), eq(sourceAccounts.isActive, true))),
      db.select({ id: liveStreams.id }).from(liveStreams).where(eq(liveStreams.status, 'live')),
      db
        .select({ videoId: streamSuperchatRollups.videoId })
        .from(streamSuperchatRollups)
        .where(notLike(streamSuperchatRollups.videoId, 'seed-%')),
    ]);

    return NextResponse.json({
      ok: true,
      channelsTotal: channelsTotal.length,
      channelsWithChannelId: channelsWithId.length,
      liveStreamsNow: liveCount.length,
      realStreamRollups: rollupsCount.length,
      hint:
        channelsWithId.length === 0
          ? 'Run pnpm run resolve:channels (with DATABASE_URL = Railway public URL) so detect_live_streams can find channels.'
          : liveCount.length === 0 && rollupsCount.length === 0
            ? 'Worker likely not running. Add Redis, set REDIS_URL, use start:with-worker, redeploy, then hit /api/cron/live.'
            : null,
    });
  } catch (e) {
    console.error('Live status error:', e);
    return NextResponse.json(
      { ok: false, error: (e as Error).message, hint: 'Check DATABASE_URL and DB connectivity.' },
      { status: 500 }
    );
  }
}
