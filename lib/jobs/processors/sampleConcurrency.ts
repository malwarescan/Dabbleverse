import { Job } from 'bullmq';
import { google } from 'googleapis';
import { db } from '../../db/index';
import { liveStreams, streamConcurrencySamples } from '../../db/schema';
import { eq } from 'drizzle-orm';

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

/**
 * ConcurrencySampler: poll concurrentViewers for each live stream, store in stream_concurrency_samples.
 * Run every 30–60s (per live video or globally).
 */
export async function sampleConcurrency(job: Job) {
  const { videoId: singleVideoId } = (job.data as { videoId?: string }) ?? {};
  const now = new Date();

  const streams = singleVideoId
    ? await db.query.liveStreams.findMany({
        where: eq(liveStreams.videoId, singleVideoId),
        columns: { videoId: true },
      })
    : await db.query.liveStreams.findMany({
        where: eq(liveStreams.status, 'live'),
        columns: { videoId: true },
      });

  let sampled = 0;
  for (const s of streams) {
    try {
      const res = await youtube.videos.list({
        part: ['liveStreamingDetails'],
        id: [s.videoId],
      });
      const item = res.data.items?.[0];
      const concurrent = item?.liveStreamingDetails?.concurrentViewers;
      if (concurrent == null) continue;

      const viewers = parseInt(String(concurrent), 10);
      if (Number.isNaN(viewers)) continue;

      await db.insert(streamConcurrencySamples).values({
        videoId: s.videoId,
        sampledAt: now,
        concurrentViewers: viewers,
      });
      sampled++;
      await new Promise((r) => setTimeout(r, 100));
    } catch (err: unknown) {
      console.error(`  Concurrency sample ${s.videoId}:`, (err as Error).message);
    }
  }

  return { streamsChecked: streams.length, sampled };
}
