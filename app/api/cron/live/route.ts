import { NextResponse } from 'next/server';

const CRON_TIMEOUT_MS = 8000;

/**
 * Cron endpoint: trigger StreamDetector + ChatPoller + ConcurrencySampler (Playboard++ public pipeline).
 * Hit every 1–2 min so live streams, paid events, and concurrency are captured.
 * Optional: set CRON_SECRET and pass ?secret=CRON_SECRET or Authorization: Bearer CRON_SECRET
 * Queue is loaded only at runtime to avoid Redis connection during Next.js build (build has no redis.railway.internal).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret') ?? request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const enqueue = async () => {
    const { youtubeQueue } = await import('@/lib/jobs/youtubeQueue');
    await youtubeQueue.add('detect_live_streams', {}, { jobId: `cron-detect-${Date.now()}` });
    await youtubeQueue.add('poll_live_chat', {}, { jobId: `cron-poll-${Date.now()}` });
    await youtubeQueue.add('sample_concurrency', {}, { jobId: `cron-concurrency-${Date.now()}` });
  };

  try {
    const result = await Promise.race([
      enqueue().then(() => ({ ok: true as const })),
      new Promise<{ ok: false; error: string }>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), CRON_TIMEOUT_MS)
      ),
    ]).catch((e) => ({ ok: false as const, error: (e as Error).message }));
    if (result.ok) {
      return NextResponse.json({ ok: true, message: 'detect_live_streams + poll_live_chat + sample_concurrency enqueued' });
    }
    console.error('Cron live error:', result.error);
    return NextResponse.json({ ok: false, error: result.error, hint: 'Check REDIS_URL and that Redis is reachable.' }, { status: 500 });
  } catch (e) {
    console.error('Cron live error:', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
