import { NextRequest, NextResponse } from 'next/server';
import { getCache, setCache } from '@/lib/utils/redis';
import { getScoreboardRows } from '@/lib/utils/queries';
import { mockScoreboardData } from '@/lib/utils/mockData';
import { WindowType, ScoreboardResponse } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const window = (searchParams.get('window') || 'now') as WindowType;
    const type = searchParams.get('type') || 'all';

    // Validate window
    if (!['now', '24h', '7d'].includes(window)) {
      return NextResponse.json(
        { error: 'Invalid window parameter' },
        { status: 400 }
      );
    }

    // Cache key
    const cacheKey = `scoreboard:${window}:${type}`;

    // Try cache first
    const cached = await getCache<ScoreboardResponse>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      });
    }

    let response: ScoreboardResponse;

    try {
      // Try real data first
      const rows = await getScoreboardRows(window, 50);
      
      if (rows.length === 0) {
        console.warn(`No scoreboard rows found, using mock data for window: ${window}`);
        // Use mock data as fallback
        response = mockScoreboardData(window);
      } else {
        response = {
          computedAt: new Date().toISOString(),
          window,
          rows,
        };
      }
    } catch (dbError) {
      // Database error - use mock data
      console.warn('Database unavailable, using mock data:', dbError);
      response = mockScoreboardData(window);
    }

    // Filter by type if specified
    if (type !== 'all') {
      response.rows = response.rows.filter((row) => row.type === type);
    }

    // Cache for 30 seconds
    await setCache(cacheKey, response, { ttl: 30 });

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('Scoreboard API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
