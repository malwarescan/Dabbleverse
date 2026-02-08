import { NextRequest, NextResponse } from 'next/server';
import { getCache, setCache } from '@/lib/utils/redis';
import { getMovers } from '@/lib/utils/queries';
import { generateMockMovers } from '@/lib/utils/mockData';
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

    let response: MoversResponse | null = null;
    try {
      const cached = await getCache<MoversResponse>(cacheKey);
      if ((cached?.movers?.length ?? 0) > 0) response = cached;
    } catch (_) {}

    if (!response?.movers?.length) {
      try {
        const movers = await getMovers(window, 20);
        response = movers.length > 0
          ? { computedAt: new Date().toISOString(), window, movers }
          : generateMockMovers(window);
      } catch {
        response = generateMockMovers(window);
      }
    }
    if (!response || !response.movers?.length) response = generateMockMovers(window);

    try {
      await setCache(cacheKey, response, { ttl: 30 });
    } catch (_) {}

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('Movers API error:', error);
    const fallback = generateMockMovers('now');
    return NextResponse.json(fallback, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  }
}
