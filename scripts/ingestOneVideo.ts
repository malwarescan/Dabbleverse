/**
 * Ingest one YouTube video by ID (and its comments) into items + youtube_comment_snippets.
 * Usage: npx tsx scripts/ingestOneVideo.ts <videoId> [channelUrl]
 * Example: npx tsx scripts/ingestOneVideo.ts X_5bsQptz2U "https://www.youtube.com/@DURTYJERZEYRRAT"
 */
import 'dotenv/config';
import { google } from 'googleapis';
import { db } from '../lib/db/index';
import { sourceAccounts, items, itemMetricSnapshots, youtubeCommentSnippets } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

const youtube = google.youtube({ version: 'v3', auth: process.env.YOUTUBE_API_KEY });
const videoId = process.argv[2];
const channelUrl = process.argv[3] || 'https://www.youtube.com/@DURTYJERZEYRRAT';

if (!videoId) {
  console.error('Usage: npx tsx scripts/ingestOneVideo.ts <videoId> [channelUrl]');
  process.exit(1);
}

async function main() {
  const account = await db.query.sourceAccounts.findFirst({
    where: eq(sourceAccounts.sourceUrl, channelUrl),
  });
  if (!account?.channelId) {
    console.error('Channel not in source_accounts or channelId not resolved:', channelUrl);
    process.exit(1);
  }

  const videosRes = await youtube.videos.list({
    part: ['snippet', 'statistics', 'contentDetails'],
    id: [videoId],
  });
  const video = videosRes.data.items?.[0];
  if (!video) {
    console.error('Video not found:', videoId);
    process.exit(1);
  }

  const snippet = video.snippet!;
  const stats = video.statistics || {};
  const contentDetails = video.contentDetails || {};
  const durationMatch = contentDetails.duration?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  const durationSeconds = durationMatch
    ? (parseInt(durationMatch[1] || '0') * 3600) +
      (parseInt(durationMatch[2] || '0') * 60) +
      (parseInt(durationMatch[3] || '0'))
    : null;

  const [item] = await db
    .insert(items)
    .values({
      platform: 'youtube',
      tier: account.tier,
      sourceAccountId: account.id,
      platformItemId: videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: snippet.title || '',
      content: snippet.description || '',
      author: snippet.channelTitle || '',
      channelId: snippet.channelId || '',
      channelTitle: snippet.channelTitle || '',
      publishedAt: new Date(snippet.publishedAt!),
      fetchedAt: new Date(),
      durationSeconds,
      metricsSnapshot: {
        views: parseInt(stats.viewCount || '0'),
        likes: parseInt(stats.likeCount || '0'),
        comments: parseInt(stats.commentCount || '0'),
      },
      rawPayload: video as object,
    })
    .onConflictDoUpdate({
      target: [items.platform, items.platformItemId],
      set: {
        title: snippet.title || '',
        content: snippet.description || '',
        fetchedAt: new Date(),
        durationSeconds,
        metricsSnapshot: {
          views: parseInt(stats.viewCount || '0'),
          likes: parseInt(stats.likeCount || '0'),
          comments: parseInt(stats.commentCount || '0'),
        },
        rawPayload: video as object,
      },
    })
    .returning();

  await db.insert(itemMetricSnapshots).values({
    itemId: item.id,
    capturedAt: new Date(),
    views: parseInt(stats.viewCount || '0'),
    likes: parseInt(stats.likeCount || '0'),
    comments: parseInt(stats.commentCount || '0'),
  });

  console.log('Video ingested:', snippet.title?.slice(0, 60));

  let totalComments = 0;
  try {
    let nextPageToken: string | undefined;
    do {
      const commentsRes = await youtube.commentThreads.list({
        part: ['snippet'],
        videoId,
        maxResults: 100,
        order: 'relevance',
        pageToken: nextPageToken,
      });
      const threads = commentsRes.data.items || [];
      nextPageToken = commentsRes.data.nextPageToken || undefined;

      for (const thread of threads) {
        const top = thread.snippet?.topLevelComment;
        const snip = top?.snippet;
        if (!snip?.textDisplay || !top?.id) continue;
        const text = (snip.textDisplay || snip.textOriginal || '').replace(/<[^>]*>/g, '').trim();
        if (!text) continue;
        await db
          .insert(youtubeCommentSnippets)
          .values({
            itemId: item.id,
            youtubeCommentId: top.id,
            text,
            authorDisplayName: snip.authorDisplayName || 'Unknown',
            likeCount: snip.likeCount || 0,
            publishedAt: new Date(snip.publishedAt!),
          })
          .onConflictDoNothing({ target: [youtubeCommentSnippets.itemId, youtubeCommentSnippets.youtubeCommentId] });
        totalComments++;
      }
    } while (nextPageToken);
    console.log('Comment snippets stored:', totalComments);
  } catch (e: unknown) {
    console.warn('Comments not stored (table may be missing; run db:push):', (e as Error).message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
