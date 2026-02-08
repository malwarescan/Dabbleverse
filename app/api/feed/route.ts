import { NextRequest, NextResponse } from 'next/server';
import { getCache, setCache } from '@/lib/utils/redis';
import { getFeedCards } from '@/lib/utils/queries';
import { generateMockFeed } from '@/lib/utils/mockData';
import { WindowType, FeedResponse } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const window = (searchParams.get('window') || 'now') as WindowType;

    // Validate window
    if (!['now', '24h', '7d'].includes(window)) {
      return NextResponse.json(
        { error: 'Invalid window parameter' },
        { status: 400 }
      );
    }

    // Cache key
    const cacheKey = `feed:${window}`;

    let response: FeedResponse | null = null;
    try {
      const cached = await getCache<FeedResponse>(cacheKey);
      if ((cached?.cards?.length ?? 0) > 0) response = cached;
    } catch (_) {}

    if (!response?.cards?.length) {
      try {
        const cards = await getFeedCards(window, 50);
        response = cards.length > 0
          ? { computedAt: new Date().toISOString(), window, cards }
          : generateMockFeed(window);
      } catch {
        response = generateMockFeed(window);
      }
    }
    if (!response || !response.cards?.length) response = generateMockFeed(window);

    try {
      await setCache(cacheKey, response, { ttl: 30 });
    } catch (_) {}

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('Feed API error:', error);
    const fallback: FeedResponse = generateMockFeed('now');
    return NextResponse.json(fallback, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  }
}
