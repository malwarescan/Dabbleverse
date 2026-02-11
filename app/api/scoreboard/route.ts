import { NextRequest, NextResponse } from 'next/server';
import { getCache, setCache } from '@/lib/utils/redis';
import { getScoreboardRows, getTodayProfitByChannelName } from '@/lib/utils/queries';
import { generateMockScoreboard } from '@/lib/utils/mockData';
import { WindowType, ScoreboardResponse } from '@/lib/types';
import { getLeaderboardChannelsForScoreboard } from '@/lib/utils/queries';

function normalizeName(name: string): string {
  return (name || '').toLowerCase().replace(/\s+/g, '').replace(/^@/, '');
}

/** Scoreboard entity name (normalized) -> channel name (normalized) so profit matches by name. */
const NAME_TO_CHANNEL: Record<string, string> = {
  chadzumock: 'sitdownzumock',
  'sitdownzumock': 'sitdownzumock',
  stutteringjohn: 'stutteringjohn7665',
  stutteringjohnmelendez: 'stutteringjohn7665',
  stutteringjohn7665: 'stutteringjohn7665',
  mlcpodcast: 'mlcpodcast',
  mlc: 'mlcpodcast',
  nobodylikesonions: 'nobodylikesonions',
  nlo: 'nobodylikesonions',
  byb: 'byb_pod',
  bybpod: 'byb_pod',
  byb_pod: 'byb_pod',
  nicepodcaststupidlive: 'nicepodcaststupidlive',
  nicepodcast: 'nicepodcaststupidlive',
  bedabbler: 'bedabbler',
};

/** Add every channel name variant so scoreboard rows match by name. */
async function getProfitMap(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const channels = await getLeaderboardChannelsForScoreboard();
    for (const ch of channels) {
      const gross = ch.grossUsd;
      const d = normalizeName(ch.displayName);
      if (d) map.set(d, gross);
      if (ch.handle) {
        const h = normalizeName(ch.handle);
        if (h) map.set(h, gross);
        const noDigits = h.replace(/\d+/g, '');
        if (noDigits && noDigits !== h) map.set(noDigits, gross);
      }
    }
    if (map.size > 0) return map;
  } catch (e) {
    console.error('Scoreboard profit:', e);
  }
  return getTodayProfitByChannelName();
}

/** Find profit for a scoreboard row by matching row name to channel names (exact -> alias -> longest substring). */
function matchRowToProfit(rowName: string, profitMap: Map<string, number>, entriesByLength: [string, number][]): number | null {
  const key = normalizeName(rowName);
  let val = profitMap.get(key);
  if (val != null) return val;
  const channelKey = NAME_TO_CHANNEL[key];
  if (channelKey) {
    val = profitMap.get(channelKey);
    if (val != null) return val;
  }
  for (const [k, v] of entriesByLength) {
    if (key.length >= 2 && k.length >= 2 && (key.includes(k) || k.includes(key))) return v;
  }
  return null;
}

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

    // Match each scoreboard row to channel by name (exact then longest substring)
    try {
      const profitMap = await getProfitMap();
      const entriesByLength = Array.from(profitMap.entries()).sort((a, b) => b[0].length - a[0].length);
      for (const row of response.rows) {
        row.profitToday = matchRowToProfit(row.name, profitMap, entriesByLength);
      }
    } catch (_) {}

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
