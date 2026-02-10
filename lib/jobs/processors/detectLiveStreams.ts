import { Job } from 'bullmq';
import { google } from 'googleapis';
import { db } from '../../db/index';
import { sourceAccounts, liveStreams } from '../../db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

/**
 * Find channels that are currently live; insert/update live_streams and return
 * list of (videoId, activeLiveChatId) so a chat poller can be enqueued.
 */
export async function detectLiveStreams(job: Job) {
  console.log('\n🔴 Detecting live streams for tracked channels...');

  // Only channels with resolved channel_id can be checked (run resolve:channels or resolve_channels job after seeding)
  const channels = await db.query.sourceAccounts.findMany({
    where: and(
      eq(sourceAccounts.platform, 'youtube'),
      eq(sourceAccounts.isActive, true),
      isNotNull(sourceAccounts.channelId)
    ),
    columns: { id: true, channelId: true, displayName: true, handle: true },
  });

  if (channels.length === 0) {
    console.log('  ⚠️ No channels with channel_id — run pnpm run resolve:channels (or resolve_channels job) so live detection can run.');
    return { detected: 0 };
  }

  const now = new Date();
  let detected = 0;

  for (const ch of channels) {
    if (!ch.channelId) continue;
    try {
      const channelRes = await youtube.channels.list({
        part: ['contentDetails'],
        id: [ch.channelId],
      });
      const uploadsId = channelRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      if (!uploadsId) continue;

      const playlistRes = await youtube.playlistItems.list({
        part: ['contentDetails', 'snippet'],
        playlistId: uploadsId,
        maxResults: 5,
      });
      const videoIds = (playlistRes.data.items ?? [])
        .map((i) => i.contentDetails?.videoId)
        .filter(Boolean) as string[];
      if (videoIds.length === 0) continue;

      const videoRes = await youtube.videos.list({
        part: ['snippet', 'liveStreamingDetails'],
        id: videoIds,
      });
      const liveVideo = (videoRes.data.items ?? []).find(
        (v) => v.liveStreamingDetails?.activeLiveChatId && v.snippet?.liveBroadcastContent === 'live'
      );
      if (!liveVideo?.id) continue;

      const videoId = liveVideo.id;
      const liveChatId = liveVideo.liveStreamingDetails?.activeLiveChatId;
      const title = liveVideo.snippet?.title ?? '';

      if (!liveChatId) continue;

      await db
        .insert(liveStreams)
        .values({
          videoId,
          sourceAccountId: ch.id,
          title,
          startedAt: new Date(liveVideo.liveStreamingDetails?.actualStartTime ?? now.toISOString()),
          status: 'live',
          activeLiveChatId: liveChatId,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [liveStreams.videoId],
          set: {
            status: 'live',
            activeLiveChatId: liveChatId,
            title,
            updatedAt: now,
          },
        });

      detected++;
      console.log(`  ✅ Live: ${ch.displayName || ch.handle} — ${videoId}`);
      await new Promise((r) => setTimeout(r, 150));
    } catch (err: unknown) {
      console.error(`  ❌ ${ch.displayName || ch.handle}:`, (err as Error).message);
    }
  }

  console.log(`\n🔴 Detected ${detected} live stream(s).`);
  return { channelsChecked: channels.length, liveCount: detected };
}
