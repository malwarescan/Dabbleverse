import { NextRequest, NextResponse } from 'next/server';
import { getCache, setCache } from '@/lib/utils/redis';
import { getFeedCards } from '@/lib/utils/queries';
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

    // ✅ REAL DATA - No more mock!
    const cards = await getFeedCards(window, 50);
    
    const response: FeedResponse = {
      computedAt: new Date().toISOString(),
      window,
      cards,
    };
    
    // Fallback to empty if no data yet
    if (cards.length === 0) {
      console.warn(`No feed cards found for window: ${window}`);
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
