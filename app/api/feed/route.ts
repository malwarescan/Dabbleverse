import { NextRequest, NextResponse } from 'next/server';
import { getCache, setCache } from '@/lib/utils/redis';
import { getFeedCards } from '@/lib/utils/queries';
import { mockFeedData } from '@/lib/utils/mockData';
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

    // Try cache first
    const cached = await getCache<FeedResponse>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      });
    }

    let response: FeedResponse;

    try {
      // Try real data first
      const cards = await getFeedCards(window, 50);
      
      if (cards.length === 0) {
        console.warn(`No feed cards found, using mock data for window: ${window}`);
        response = mockFeedData(window);
      } else {
        response = {
          computedAt: new Date().toISOString(),
          window,
          cards,
        };
      }
    } catch (dbError) {
      console.warn('Database unavailable, using mock data:', dbError);
      response = mockFeedData(window);
    }

    // Cache for 30 seconds
    await setCache(cacheKey, response, { ttl: 30 });

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('Feed API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
