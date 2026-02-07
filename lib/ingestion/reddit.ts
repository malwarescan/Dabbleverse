import Snoowrap from 'snoowrap';
import { db, items, watchlists } from '@/lib/db';
import { eq, and } from 'drizzle-orm';

// Initialize Reddit client
let reddit: Snoowrap | null = null;

function getRedditClient(): Snoowrap {
  if (!reddit) {
    reddit = new Snoowrap({
      userAgent: process.env.REDDIT_USER_AGENT || 'DabbleverseDashboard/1.0',
      clientId: process.env.REDDIT_CLIENT_ID!,
      clientSecret: process.env.REDDIT_CLIENT_SECRET!,
      username: '',
      password: '',
    });
  }
  return reddit;
}

export interface RedditPostData {
  id: string;
  title: string;
  author: string;
  subreddit: string;
  createdAt: string;
  upvotes: number;
  comments: number;
  url: string;
  permalink: string;
  selftext: string;
}

/**
 * Fetch posts from a specific subreddit
 */
export async function fetchSubredditPosts(
  subredditName: string,
  limit: number = 100,
  timeFilter: 'hour' | 'day' | 'week' | 'month' = 'week'
): Promise<RedditPostData[]> {
  try {
    const client = getRedditClient();
    const subreddit = client.getSubreddit(subredditName);

    // @ts-ignore - snoowrap types are incomplete
    const posts = await subreddit.getTop({ limit, time: timeFilter });

    return posts.map((post) => ({
      id: post.id,
      title: post.title,
      author: post.author.name,
      subreddit: post.subreddit.display_name,
      createdAt: new Date(post.created_utc * 1000).toISOString(),
      upvotes: post.ups,
      comments: post.num_comments,
      url: post.url,
      permalink: `https://reddit.com${post.permalink}`,
      selftext: post.selftext || '',
    }));
  } catch (error) {
    console.error(`Error fetching subreddit ${subredditName}:`, error);
    return [];
  }
}

/**
 * Search Reddit for keywords
 */
export async function searchReddit(
  keywords: string[],
  subreddits: string[] = [],
  limit: number = 100
): Promise<RedditPostData[]> {
  try {
    const client = getRedditClient();
    const allPosts: RedditPostData[] = [];

    for (const keyword of keywords) {
      const searchQuery = keyword;
      const subredditScope = subreddits.length > 0 ? subreddits.join('+') : 'all';

      const subreddit = client.getSubreddit(subredditScope);
      const posts = await subreddit.search({
        query: searchQuery,
        limit,
        time: 'week',
        sort: 'relevance',
      } as any);

      allPosts.push(
        ...posts.map((post) => ({
          id: post.id,
          title: post.title,
          author: post.author.name,
          subreddit: post.subreddit.display_name,
          createdAt: new Date(post.created_utc * 1000).toISOString(),
          upvotes: post.ups,
          comments: post.num_comments,
          url: post.url,
          permalink: `https://reddit.com${post.permalink}`,
          selftext: post.selftext || '',
        }))
      );
    }

    return allPosts;
  } catch (error) {
    console.error('Error searching Reddit:', error);
    return [];
  }
}

/**
 * Store Reddit post data in database
 */
export async function storeRedditPost(post: RedditPostData): Promise<void> {
  try {
    await db.insert(items).values({
      platform: 'reddit',
      tier: null, // Legacy function - tier not available
      sourceAccountId: null, // Legacy function - no source account tracking
      platformItemId: post.id,
      url: post.permalink,
      title: post.title,
      content: post.selftext,
      author: post.author,
      channelId: post.subreddit, // Store subreddit as channelId
      channelTitle: post.subreddit,
      publishedAt: new Date(post.createdAt),
      durationSeconds: null, // Not applicable for Reddit posts
      metricsSnapshot: {
        upvotes: post.upvotes,
        comments: post.comments,
      },
      rawPayload: post,
    }).onConflictDoNothing();
  } catch (error) {
    console.error('Error storing Reddit post:', error);
  }
}

/**
 * Main Reddit ingestion job (Phase 2)
 */
export async function ingestReddit(): Promise<void> {
  console.log('Starting Reddit ingestion...');

  try {
    // Get enabled Reddit watchlist
    const subreddits = await db
      .select()
      .from(watchlists)
      .where(and(eq(watchlists.platform, 'reddit'), eq(watchlists.enabled, true)));

    console.log(`Found ${subreddits.length} enabled subreddits`);

    // Fetch from each subreddit
    for (const sub of subreddits) {
      console.log(`Fetching posts from r/${sub.identifier}...`);
      const posts = await fetchSubredditPosts(sub.identifier);
      console.log(`Found ${posts.length} posts`);

      for (const post of posts) {
        await storeRedditPost(post);
      }
    }

    console.log('Reddit ingestion completed');
  } catch (error) {
    console.error('Reddit ingestion failed:', error);
    throw error;
  }
}
