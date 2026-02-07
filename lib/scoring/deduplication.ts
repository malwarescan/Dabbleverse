import crypto from 'crypto';
import { db, items, events, eventItems, itemMetricSnapshots } from '@/lib/db';
import { eq, and, gte } from 'drizzle-orm';

/**
 * Generate event key (hash) for deduplication
 */
export function generateEventKey(
  url: string,
  title: string,
  platformItemId: string
): string {
  // Priority 1: Use canonical URL if available
  if (url) {
    const normalized = normalizeUrl(url);
    return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  }

  // Priority 2: Use platform item ID
  if (platformItemId) {
    return crypto.createHash('sha256').update(platformItemId).digest('hex').slice(0, 16);
  }

  // Priority 3: Use normalized title similarity hash
  const normalized = normalizeTitle(title);
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

/**
 * Normalize URL for comparison
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    
    // YouTube URLs: extract video ID
    if (parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be')) {
      const videoId = parsed.searchParams.get('v') || parsed.pathname.split('/').pop();
      return `youtube:${videoId}`;
    }

    // Reddit URLs: extract post ID
    if (parsed.hostname.includes('reddit.com')) {
      const match = parsed.pathname.match(/\/comments\/([a-z0-9]+)/);
      if (match) {
        return `reddit:${match[1]}`;
      }
    }

    // Generic URL normalization
    return `${parsed.hostname}${parsed.pathname}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Normalize title for similarity comparison
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate title similarity (Jaccard index)
 */
function calculateTitleSimilarity(title1: string, title2: string): number {
  const words1 = new Set(normalizeTitle(title1).split(' '));
  const words2 = new Set(normalizeTitle(title2).split(' '));

  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Find or create event for an item
 */
export async function findOrCreateEvent(itemId: string): Promise<string> {
  try {
    // Get the item
    const [item] = await db
      .select()
      .from(items)
      .where(eq(items.id, itemId))
      .limit(1);

    if (!item) {
      throw new Error(`Item ${itemId} not found`);
    }

    // Generate event key
    const eventKey = generateEventKey(
      item.url,
      item.title || '',
      item.platformItemId
    );

    // Check if event already exists
    const existingEvents = await db
      .select()
      .from(events)
      .where(eq(events.eventKey, eventKey))
      .limit(1);

    if (existingEvents.length > 0) {
      const event = existingEvents[0];

      // Update event with new item
      await db.update(events)
        .set({
          lastSeenAt: new Date(),
          itemCount: event.itemCount + 1,
        })
        .where(eq(events.id, event.id));

      // Link item to event
      await db.insert(eventItems).values({
        eventId: event.id,
        itemId: item.id,
      }).onConflictDoNothing();

      return event.id;
    }

    // Check for similar recent events (title similarity within time window)
    const recentTimeThreshold = new Date(Date.now() - 6 * 60 * 60 * 1000); // 6 hours
    const recentEvents = await db
      .select()
      .from(events)
      .where(gte(events.firstSeenAt, recentTimeThreshold))
      .limit(100);

    for (const event of recentEvents) {
      const similarity = calculateTitleSimilarity(event.eventTitle, item.title || '');
      if (similarity > 0.7) {
        // High similarity, merge into existing event

        await db.update(events)
          .set({
            lastSeenAt: new Date(),
            itemCount: event.itemCount + 1,
          })
          .where(eq(events.id, event.id));

        await db.insert(eventItems).values({
          eventId: event.id,
          itemId: item.id,
        }).onConflictDoNothing();

        return event.id;
      }
    }

    // Create new event
    const [newEvent] = await db.insert(events).values({
      eventKey,
      firstSeenAt: item.publishedAt,
      lastSeenAt: item.publishedAt,
      primaryItemId: item.id,
      platformMix: {
        youtube: item.platform === 'youtube',
        reddit: item.platform === 'reddit',
        x: item.platform === 'x',
      },
      eventTitle: item.title || '',
      eventSummary: null,
      itemCount: 1,
    }).returning();

    // Link item to event
    await db.insert(eventItems).values({
      eventId: newEvent.id,
      itemId: item.id,
    });

    return newEvent.id;
  } catch (error) {
    console.error('Error in findOrCreateEvent:', error);
    throw error;
  }
}

/**
 * Deduplicate all recent items (batch processing)
 */
export async function deduplicateRecentItems(
  hoursBack: number = 24
): Promise<number> {
  try {
    const timeThreshold = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    const recentItems = await db
      .select()
      .from(items)
      .where(gte(items.fetchedAt, timeThreshold));

    console.log(`Deduplicating ${recentItems.length} recent items...`);

    let processed = 0;
    for (const item of recentItems) {
      await findOrCreateEvent(item.id);
      processed++;

      if (processed % 100 === 0) {
        console.log(`Processed ${processed}/${recentItems.length} items`);
      }
    }

    console.log(`Deduplication completed: ${processed} items processed`);
    return processed;
  } catch (error) {
    console.error('Error in deduplicateRecentItems:', error);
    throw error;
  }
}

// ==================================================
// NEW ENHANCED DEDUPLICATION ALGORITHM (YouTube V2)
// ==================================================

const STOPWORDS = new Set([
  'dabbleverse', 'dabble', 'clip', 'clips', 'reaction', 'reactions',
  'highlights', 'live', 'stream', 'streams', 'podcast', 'podcasts',
  'show', 'shows', 'episode', 'episodes'
]);

const JACCARD_THRESHOLD = 0.55;
const TIME_BUCKET_HOURS = 6;

function normalizeTitleV2(title: string, channelTitle: string): string[] {
  // Lowercase + remove punctuation
  let normalized = title.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Remove channel name tokens
  const channelTokens = channelTitle.toLowerCase().split(/\s+/);
  channelTokens.forEach(token => {
    normalized = normalized.replace(new RegExp(`\\b${token}\\b`, 'g'), '');
  });
  
  // Tokenize and filter
  const tokens = normalized.split(/\s+/)
    .filter(token => token.length >= 3)
    .filter(token => !STOPWORDS.has(token));
  
  return tokens;
}

function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

function getTimeBucket(date: Date): string {
  const hours = Math.floor(date.getTime() / (1000 * 60 * 60));
  const bucket = Math.floor(hours / TIME_BUCKET_HOURS) * TIME_BUCKET_HOURS;
  return new Date(bucket * 60 * 60 * 1000).toISOString();
}

function generateEventKeyV2(tokens: string[], timeBucket: string): string {
  const topTokens = tokens.slice(0, 8).sort().join('_');
  const keyInput = `${timeBucket}|${topTokens}`;
  return 'yt:' + crypto.createHash('sha1').update(keyInput).digest('hex').substring(0, 16);
}

/**
 * NEW: YouTube-specific deduplication with enhanced algorithm
 */
export async function deduplicateYouTubeItems() {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000); // Last 48h
  
  // Get recent clipper items
  const recentItems = await db.query.items.findMany({
    where: and(
      eq(items.platform, 'youtube'),
      gte(items.publishedAt, cutoff)
    ),
    orderBy: (items, { desc }) => [desc(items.publishedAt)],
  });
  
  console.log(`\n🔗 Processing ${recentItems.length} recent YouTube items for deduplication...\n`);
  
  let createdEvents = 0;
  let attachedToExisting = 0;
  
  for (const item of recentItems) {
    if (!item.title) continue;
    
    // Normalize title into tokens
    const tokens = normalizeTitleV2(item.title, item.channelTitle || '');
    if (tokens.length === 0) continue;
    
    const timeBucket = getTimeBucket(item.publishedAt);
    const tokenSet = new Set(tokens);
    
    // Check for existing events in same time bucket
    const candidateEvents = await db.query.events.findMany({
      where: gte(events.firstSeenAt, new Date(Date.now() - 12 * 60 * 60 * 1000)), // 12h window
      limit: 100,
    });
    
    let matchedEvent = null;
    let bestSimilarity = 0;
    
    for (const event of candidateEvents) {
      if (!event.primaryItemId) continue;
      
      // Get primary item for this event
      const primaryItem = await db.query.items.findFirst({
        where: eq(items.id, event.primaryItemId),
      });
      
      if (!primaryItem) continue;
      
      const eventTokens = normalizeTitleV2(primaryItem.title || '', primaryItem.channelTitle || '');
      const eventTokenSet = new Set(eventTokens);
      
      const similarity = jaccardSimilarity(tokenSet, eventTokenSet);
      
      if (similarity >= JACCARD_THRESHOLD && similarity > bestSimilarity) {
        matchedEvent = event;
        bestSimilarity = similarity;
      }
    }
    
    if (matchedEvent) {
      // Attach to existing event
      await db.insert(eventItems)
        .values({
          eventId: matchedEvent.id,
          itemId: item.id,
        })
        .onConflictDoNothing();
      
      // Update event's last_seen_at + related_count
      const relatedCount = await db.query.eventItems.findMany({
        where: eq(eventItems.eventId, matchedEvent.id),
      });
      
      await db.update(events)
        .set({
          lastSeenAt: new Date(),
          relatedCount: relatedCount.length,
          updatedAt: new Date(),
        })
        .where(eq(events.id, matchedEvent.id));
      
      console.log(`  ✅ Attached "${item.title.substring(0, 60)}..." to event (similarity: ${(bestSimilarity * 100).toFixed(0)}%)`);
      attachedToExisting++;
      
    } else {
      // Create new event
      const eventKey = generateEventKeyV2(tokens, timeBucket);
      
      const [newEvent] = await db.insert(events)
        .values({
          eventKey,
          eventTitle: item.title,
          firstSeenAt: item.publishedAt,
          lastSeenAt: item.publishedAt,
          primaryItemId: item.id,
          platformMix: { youtube: true, reddit: false, x: false },
          relatedCount: 1,
          itemCount: 1,
        })
        .onConflictDoNothing()
        .returning();
      
      if (newEvent) {
        await db.insert(eventItems)
          .values({
            eventId: newEvent.id,
            itemId: item.id,
          });
        
        console.log(`  🆕 Created new event: "${item.title.substring(0, 60)}..."`);
        createdEvents++;
      }
    }
  }
  
  console.log(`\n✅ Deduplication complete:`);
  console.log(`    New events: ${createdEvents}`);
  console.log(`    Attached to existing: ${attachedToExisting}`);
  console.log(`    Total processed: ${recentItems.length}`);
  
  // Update primary items (choose highest velocity)
  await updatePrimaryItems();
  
  return { 
    processed: recentItems.length,
    createdEvents,
    attachedToExisting
  };
}

async function updatePrimaryItems() {
  console.log('\n🎯 Updating primary items based on velocity...');
  
  // Get all events
  const allEvents = await db.query.events.findMany({
    limit: 500,
  });
  
  let updated = 0;
  
  for (const event of allEvents) {
    // Get all items in this event
    const eventItemsData = await db.query.eventItems.findMany({
      where: eq(eventItems.eventId, event.id),
    });
    
    if (eventItemsData.length === 0) continue;
    
    let bestItem = null;
    let bestVelocity = 0;
    
    for (const { itemId } of eventItemsData) {
      const item = await db.query.items.findFirst({
        where: eq(items.id, itemId),
      });
      
      if (!item) continue;
      
      // Get last two snapshots
      const snapshots = await db.query.itemMetricSnapshots.findMany({
        where: eq(itemMetricSnapshots.itemId, item.id),
        orderBy: (itemMetricSnapshots, { desc }) => [desc(itemMetricSnapshots.capturedAt)],
        limit: 2,
      });
      
      let velocity = 0;
      if (snapshots.length === 2) {
        const timeDiff = (snapshots[0].capturedAt.getTime() - snapshots[1].capturedAt.getTime()) / 60000; // minutes
        const viewDiff = (snapshots[0].views || 0) - (snapshots[1].views || 0);
        velocity = timeDiff > 0 ? viewDiff / timeDiff : 0;
      } else if (snapshots.length === 1) {
        velocity = snapshots[0].views || 0; // Fallback to total views
      }
      
      if (velocity > bestVelocity) {
        bestVelocity = velocity;
        bestItem = item;
      }
    }
    
    if (bestItem && bestItem.id !== event.primaryItemId) {
      await db.update(events)
        .set({ 
          primaryItemId: bestItem.id,
          eventTitle: bestItem.title || event.eventTitle,
          updatedAt: new Date(),
        })
        .where(eq(events.id, event.id));
      
      updated++;
    }
  }
  
  console.log(`  ✅ Updated ${updated} primary items`);
}
