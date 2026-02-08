import { NextRequest, NextResponse } from 'next/server';
import { getCache, setCache } from '@/lib/utils/redis';
import { getScoreboardRows } from '@/lib/utils/queries';
import { generateMockScoreboard } from '@/lib/utils/mockData';
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

    let response: ScoreboardResponse | null = null;
    try {
      const cached = await getCache<ScoreboardResponse>(cacheKey);
      if ((cached?.rows?.length ?? 0) > 0) response = cached;
    } catch (_) {}

    if (!response?.rows?.length) {
      try {
        const rows = await getScoreboardRows(window, 50);
        if (rows.length > 0) {
          response = { computedAt: new Date().toISOString(), window, rows };
        } else {
          response = generateMockScoreboard(window);
        }
      } catch {
        response = generateMockScoreboard(window);
      }
    }

    if (type !== 'all') {
      response.rows = response.rows.filter((row) => row.type === type);
    }
    if (!response || response.rows.length === 0) {
      response = generateMockScoreboard(window);
      if (type !== 'all') response.rows = response.rows.filter((row) => row.type === type);
    }

    try {
      await setCache(cacheKey, response, { ttl: 30 });
    } catch (_) {}

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('Scoreboard API error:', error);
    const fallback = generateMockScoreboard('now');
    return NextResponse.json(fallback, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  }
}
