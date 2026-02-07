import { google, youtube_v3 } from 'googleapis';
import { db, items, watchlists } from '@/lib/db';
import { eq, and } from 'drizzle-orm';

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

export interface YouTubeVideoData {
  id: string;
  title: string;
  channel: string;
  channelId: string;
  publishedAt: string;
  views: number;
  likes: number;
  comments: number;
  url: string;
}

/**
 * Fetch videos from a specific channel
 */
export async function fetchChannelVideos(
  channelId: string,
  maxResults: number = 50,
  publishedAfterHours: number = 72
): Promise<YouTubeVideoData[]> {
  try {
    const publishedAfter = new Date(
      Date.now() - publishedAfterHours * 60 * 60 * 1000
    ).toISOString();

    const searchResponse = await youtube.search.list({
      part: ['snippet'],
      channelId,
      maxResults,
      order: 'date',
      publishedAfter,
      type: ['video'],
    });

    const videoIds = searchResponse.data.items
      ?.map((item) => item.id?.videoId)
      .filter(Boolean) as string[];

    if (!videoIds || videoIds.length === 0) {
      return [];
    }

    // Get video statistics
    const videosResponse = await youtube.videos.list({
      part: ['snippet', 'statistics'],
      id: videoIds,
    });

    const videos = videosResponse.data.items || [];

    return videos.map((video) => ({
      id: video.id!,
      title: video.snippet?.title || '',
      channel: video.snippet?.channelTitle || '',
      channelId: video.snippet?.channelId || '',
      publishedAt: video.snippet?.publishedAt || '',
      views: parseInt(video.statistics?.viewCount || '0'),
      likes: parseInt(video.statistics?.likeCount || '0'),
      comments: parseInt(video.statistics?.commentCount || '0'),
      url: `https://youtube.com/watch?v=${video.id}`,
    }));
  } catch (error) {
    console.error(`Error fetching channel ${channelId}:`, error);
    return [];
  }
}

/**
 * Search YouTube for keywords
 */
export async function searchYouTube(
  keywords: string[],
  maxResults: number = 50,
  publishedAfterHours: number = 72
): Promise<YouTubeVideoData[]> {
  try {
    const publishedAfter = new Date(
      Date.now() - publishedAfterHours * 60 * 60 * 1000
    ).toISOString();

    const allVideos: YouTubeVideoData[] = [];

    for (const keyword of keywords) {
      const searchResponse = await youtube.search.list({
        part: ['snippet'],
        q: keyword,
        maxResults,
        order: 'relevance',
        publishedAfter,
        type: ['video'],
      });

      const videoIds = searchResponse.data.items
        ?.map((item) => item.id?.videoId)
        .filter(Boolean) as string[];

      if (!videoIds || videoIds.length === 0) {
        continue;
      }

      // Get video statistics
      const videosResponse = await youtube.videos.list({
        part: ['snippet', 'statistics'],
        id: videoIds,
      });

      const videos = videosResponse.data.items || [];

      allVideos.push(
        ...videos.map((video) => ({
          id: video.id!,
          title: video.snippet?.title || '',
          channel: video.snippet?.channelTitle || '',
          channelId: video.snippet?.channelId || '',
          publishedAt: video.snippet?.publishedAt || '',
          views: parseInt(video.statistics?.viewCount || '0'),
          likes: parseInt(video.statistics?.likeCount || '0'),
          comments: parseInt(video.statistics?.commentCount || '0'),
          url: `https://youtube.com/watch?v=${video.id}`,
        }))
      );
    }

    return allVideos;
  } catch (error) {
    console.error('Error searching YouTube:', error);
    return [];
  }
}

/**
 * Store YouTube video data in database
 */
export async function storeYouTubeVideo(video: YouTubeVideoData): Promise<void> {
  try {
    await db.insert(items).values({
      platform: 'youtube',
      tier: null, // Legacy function - tier not available
      sourceAccountId: null, // Legacy function - no source account tracking
      platformItemId: video.id,
      url: video.url,
      title: video.title,
      content: '', // No description in legacy format
      author: video.channel,
      channelId: '', // Not available in legacy format
      channelTitle: video.channel,
      publishedAt: new Date(video.publishedAt),
      durationSeconds: null, // Not available in legacy format
      metricsSnapshot: {
        views: video.views,
        likes: video.likes,
        comments: video.comments,
      },
      rawPayload: video,
    }).onConflictDoNothing();
  } catch (error) {
    console.error('Error storing YouTube video:', error);
  }
}

/**
 * Main YouTube ingestion job
 */
export async function ingestYouTube(): Promise<void> {
  console.log('Starting YouTube ingestion...');

  try {
    // Get enabled YouTube watchlist
    const channels = await db
      .select()
      .from(watchlists)
      .where(and(eq(watchlists.platform, 'youtube'), eq(watchlists.enabled, true)));

    console.log(`Found ${channels.length} enabled YouTube channels`);

    // Fetch from each channel
    for (const channel of channels) {
      console.log(`Fetching videos from ${channel.name}...`);
      const videos = await fetchChannelVideos(channel.identifier);
      console.log(`Found ${videos.length} videos`);

      for (const video of videos) {
        await storeYouTubeVideo(video);
      }
    }

    // TODO: Keyword search from seed data
    // const keywords = ['dabbleverse', 'stuttering john'];
    // const searchResults = await searchYouTube(keywords);
    // for (const video of searchResults) {
    //   await storeYouTubeVideo(video);
    // }

    console.log('YouTube ingestion completed');
  } catch (error) {
    console.error('YouTube ingestion failed:', error);
    throw error;
  }
}
