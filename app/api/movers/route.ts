import { NextRequest, NextResponse } from 'next/server';
import { getCache, setCache } from '@/lib/utils/redis';
import { getMovers } from '@/lib/utils/queries';
import { WindowType, MoversResponse } from '@/lib/types';

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
    const cacheKey = `movers:${window}`;

    // Try cache first
    const cached = await getCache<MoversResponse>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      });
    }

    // ✅ REAL DATA - No more mock!
    const movers = await getMovers(window, 20);
    
    const response: MoversResponse = {
      computedAt: new Date().toISOString(),
      window,
      movers,
    };
    
    // Fallback to empty if no data yet
    if (movers.length === 0) {
      console.warn(`No movers found for window: ${window}`);
    }

    // Cache for 30 seconds
    await setCache(cacheKey, response, { ttl: 30 });

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('Movers API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
