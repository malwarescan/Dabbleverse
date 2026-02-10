import { db, scores, feedCards, entities, items, channelDailySuperchatRollups, streamSuperchatRollups, sourceAccounts } from '@/lib/db';
import { eq, desc, and, gt, notLike, inArray } from 'drizzle-orm';
import { WindowType, ScoreboardRow, MoverCard, FeedCardData } from '@/lib/types';

const MICROS_PER_DOLLAR = 1_000_000;

function normalizeName(name: string): string {
  return (name || '').toLowerCase().replace(/\s+/g, '').replace(/^@/, '');
}

/** Base of handle for matching: "stutteringjohn7665" -> "stutteringjohn" */
function handleBase(handle: string): string {
  return (handle || '').toLowerCase().replace(/\d+/g, '').replace(/\s+/g, '').replace(/^@/, '');
}

const SEED_VIDEO_PREFIX = 'seed-';

/** Today's Super Chat gross by channel (displayName/handle). Only real (worker) rollups; seeded rows excluded so demo shows when no live data. */
export async function getTodayProfitByChannelName(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const today = new Date().toISOString().slice(0, 10);
    const realAccountIds = await db
      .select({ sourceAccountId: streamSuperchatRollups.sourceAccountId })
      .from(streamSuperchatRollups)
      .where(notLike(streamSuperchatRollups.videoId, `${SEED_VIDEO_PREFIX}%`));
    const realIds = [...new Set(realAccountIds.map((r) => r.sourceAccountId))];
    if (realIds.length > 0) {
      const rollupRows = await db
        .select({
          grossAmountMicros: channelDailySuperchatRollups.grossAmountMicros,
          displayName: sourceAccounts.displayName,
          handle: sourceAccounts.handle,
        })
        .from(channelDailySuperchatRollups)
        .innerJoin(sourceAccounts, eq(channelDailySuperchatRollups.sourceAccountId, sourceAccounts.id))
        .where(
          and(
            eq(channelDailySuperchatRollups.date, today),
            inArray(channelDailySuperchatRollups.sourceAccountId, realIds)
          )
        );
      if (rollupRows.length > 0) {
        for (const r of rollupRows) {
          const grossUsd = r.grossAmountMicros / MICROS_PER_DOLLAR;
          if (r.displayName) map.set(normalizeName(r.displayName), grossUsd);
          if (r.handle) {
            map.set(normalizeName(r.handle), grossUsd);
            map.set(handleBase(r.handle), grossUsd);
          }
        }
        return map;
      }
    }

    // No real rollups: return empty — no fake demo amounts
  } catch (e) {
    console.error('getTodayProfitByChannelName:', e);
  }
  return map;
}

export async function getScoreboardRows(
  window: WindowType,
  limit: number = 50
): Promise<ScoreboardRow[]> {
  try {
    // Get the most recent computation time for this window with entity join
    const latestScores = await db
      .select({
        rank: scores.rank,
        deltaRank: scores.deltaRank,
        entityId: scores.entityId,
        score: scores.score,
        momentum: scores.momentum,
        microMomentum: scores.microMomentum,
        sourcesBreakdown: scores.sourcesBreakdown,
        driverLabel: scores.driverLabel,
        eventCount: scores.eventCount,
        computedAt: scores.computedAt,
        entityName: entities.canonicalName,
        entityType: entities.type,
      })
      .from(scores)
      .innerJoin(entities, eq(scores.entityId, entities.id))
      .where(eq(scores.window, window))
      .orderBy(desc(scores.computedAt), scores.rank)
      .limit(limit * 2); // Fetch more to handle potential duplicates

    if (latestScores.length === 0) {
      return [];
    }

    // Deduplicate by entityId (most recent wins)
    const uniqueScores = new Map<string, typeof latestScores[0]>();
    
    for (const score of latestScores) {
      if (!uniqueScores.has(score.entityId)) {
        uniqueScores.set(score.entityId, score);
      }
    }

    // Take only requested limit after deduplication
    const deduped = Array.from(uniqueScores.values()).slice(0, limit);

    // Transform to ScoreboardRow format
    return deduped.map((score) => ({
      rank: score.rank,
      deltaRank: score.deltaRank,
      entityId: score.entityId,
      name: score.entityName,
      type: score.entityType as any,
      score: parseFloat(score.score.toString()),
      momentum: parseFloat(score.momentum.toString()),
      microMomentum: score.microMomentum ? parseFloat(score.microMomentum.toString()) : undefined,
      sources: score.sourcesBreakdown as any,
      driver: score.driverLabel || null,
      eventCount: score.eventCount,
    }));
  } catch (error) {
    console.error('Error fetching scoreboard:', error);
    return [];
  }
}

export async function getMovers(
  window: WindowType,
  limit: number = 20
): Promise<MoverCard[]> {
  try {
    // Get scores with entity join ordered by absolute momentum
    const topMovers = await db
      .select({
        entityId: scores.entityId,
        momentum: scores.momentum,
        microMomentum: scores.microMomentum,
        driverLabel: scores.driverLabel,
        sourcesBreakdown: scores.sourcesBreakdown,
        eventCount: scores.eventCount,
        computedAt: scores.computedAt,
        entityName: entities.canonicalName,
        entityType: entities.type,
      })
      .from(scores)
      .innerJoin(entities, eq(scores.entityId, entities.id))
      .where(eq(scores.window, window))
      .orderBy(desc(scores.computedAt))
      .limit(100); // Get more to handle potential duplicates

    if (topMovers.length === 0) {
      return [];
    }

    // Deduplicate by entityId (most recent computedAt wins, already sorted)
    const uniqueMovers = new Map<string, typeof topMovers[0]>();
    
    for (const mover of topMovers) {
      if (!uniqueMovers.has(mover.entityId)) {
        uniqueMovers.set(mover.entityId, mover);
      }
    }

    // Sort by absolute momentum and take top movers
    const sorted = Array.from(uniqueMovers.values())
      .sort((a, b) => Math.abs(parseFloat(b.momentum.toString())) - Math.abs(parseFloat(a.momentum.toString())))
      .slice(0, limit);

    return sorted.map((score) => ({
      entityId: score.entityId,
      name: score.entityName,
      type: score.entityType as any,
      momentum: parseFloat(score.momentum.toString()),
      microMomentum: score.microMomentum ? parseFloat(score.microMomentum.toString()) : undefined,
      driver: score.driverLabel || null,
      sources: score.sourcesBreakdown as any,
      receiptCount: score.eventCount,
    }));
  } catch (error) {
    console.error('Error fetching movers:', error);
    return [];
  }
}

export async function getFeedCards(
  window: WindowType,
  limit: number = 50
): Promise<FeedCardData[]> {
  try {
    const cards = await db
      .select()
      .from(feedCards)
      .where(eq(feedCards.window, window))
      .orderBy(desc(feedCards.computedAt))
      .limit(limit * 2); // Fetch more to handle potential duplicates

    // Deduplicate by eventId (most recent computedAt wins)
    const uniqueCards = new Map<string, typeof cards[0]>();
    
    for (const card of cards) {
      const key = card.eventId;
      if (!uniqueCards.has(key)) {
        uniqueCards.set(key, card);
      }
    }

    // Take only requested limit after deduplication
    const deduped = Array.from(uniqueCards.values()).slice(0, limit);

    return deduped.map((card) => {
      // Parse meta if it's a string
      let meta;
      try {
        meta = typeof card.meta === 'string' ? JSON.parse(card.meta) : card.meta;
      } catch {
        meta = {
          author: 'Unknown',
          channel: '',
          timestamp: new Date().toISOString(),
          platform: card.source,
        };
      }
      
      return {
        id: card.id,
        source: card.source,
        title: card.title,
        meta,
        why: card.why,
        url: card.url,
        eventId: card.eventId,
        entityIds: (card.entityIds as string[]) || [],
      };
    });
  } catch (error) {
    console.error('Error fetching feed cards:', error);
    return [];
  }
}

/** Fallback: build feed cards from recent items (real URLs) when feed_cards table is empty */
export async function getFeedCardsFromRecentItems(
  limit: number = 50
): Promise<FeedCardData[]> {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // last 7 days
    const rows = await db
      .select({
        id: items.id,
        url: items.url,
        title: items.title,
        author: items.author,
        channelTitle: items.channelTitle,
        publishedAt: items.publishedAt,
        platform: items.platform,
      })
      .from(items)
      .where(gt(items.publishedAt, since))
      .orderBy(desc(items.publishedAt))
      .limit(limit);

    return rows.map((row) => ({
      id: String(row.id),
      source: row.platform as 'youtube' | 'reddit' | 'x',
      title: row.title || 'Untitled',
      meta: {
        author: row.author ?? undefined,
        channel: row.channelTitle ?? undefined,
        timestamp: row.publishedAt.toISOString(),
        platform: row.platform as 'youtube' | 'reddit' | 'x',
      },
      why: 'Recent clip or post from the feed.',
      url: row.url,
      eventId: String(row.id),
      entityIds: [],
    }));
  } catch (error) {
    console.error('Error fetching feed from items:', error);
    return [];
  }
}
