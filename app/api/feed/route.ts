import { NextRequest, NextResponse } from 'next/server';
import { getCache, setCache } from '@/lib/utils/redis';
import { getFeedCards, getFeedCardsFromRecentItems } from '@/lib/utils/queries';
import { WindowType, FeedResponse } from '@/lib/types';

/** Only allow cards that link to real content (no mock # or example.com) */
function onlyRealCards<T extends { url?: string | null }>(cards: T[]): T[] {
  return cards.filter(
    (c) =>
      c.url &&
      (c.url.startsWith('http://') || c.url.startsWith('https://')) &&
      !c.url.includes('example.com')
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const window = (searchParams.get('window') || 'now') as WindowType;

    if (!['now', '24h', '7d'].includes(window)) {
      return NextResponse.json(
        { error: 'Invalid window parameter' },
        { status: 400 }
      );
    }

    const cacheKey = `feed:${window}`;

    let response: FeedResponse | null = null;
    try {
      const cached = await getCache<FeedResponse>(cacheKey);
      const cachedReal = cached?.cards ? onlyRealCards(cached.cards) : [];
      if (cachedReal.length > 0) {
        response = { ...cached!, cards: cachedReal };
      }
    } catch (_) {}

    if (!response?.cards?.length) {
      try {
        let cards = await getFeedCards(window, 50);
        if (cards.length === 0) {
          cards = await getFeedCardsFromRecentItems(50);
        }
        const real = onlyRealCards(cards);
        response = {
          computedAt: new Date().toISOString(),
          window,
          cards: real,
        };
      } catch (e) {
        console.error('Feed fetch error:', e);
        response = {
          computedAt: new Date().toISOString(),
          window,
          cards: [],
        };
      }
    }

    if (!response) {
      response = { computedAt: new Date().toISOString(), window, cards: [] };
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
    console.error('Feed API error:', error);
    return NextResponse.json(
      {
        computedAt: new Date().toISOString(),
        window: 'now',
        cards: [],
      } as FeedResponse,
      {
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
      }
    );
  }
}
