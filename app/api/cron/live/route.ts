import { NextResponse } from 'next/server';
import { youtubeQueue } from '@/lib/jobs/youtubeQueue';

/**
 * Cron endpoint: trigger StreamDetector + ChatPoller + ConcurrencySampler (Playboard++ public pipeline).
 * Hit every 1–2 min so live streams, paid events, and concurrency are captured.
 * Optional: set CRON_SECRET and pass ?secret=CRON_SECRET or Authorization: Bearer CRON_SECRET
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret') ?? request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await youtubeQueue.add('detect_live_streams', {}, { jobId: `cron-detect-${Date.now()}` });
    await youtubeQueue.add('poll_live_chat', {}, { jobId: `cron-poll-${Date.now()}` });
    await youtubeQueue.add('sample_concurrency', {}, { jobId: `cron-concurrency-${Date.now()}` });
    return NextResponse.json({ ok: true, message: 'detect_live_streams + poll_live_chat + sample_concurrency enqueued' });
  } catch (e) {
    console.error('Cron live error:', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
