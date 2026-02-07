import { Job } from 'bullmq';
import { db } from '../../db/index';
import { events, feedCards, items } from '../../db/schema';
import { desc, eq } from 'drizzle-orm';
import { formatDistanceToNow } from 'date-fns';

const WINDOWS = ['now', '24h', '7d'] as const;

export async function buildFeedCards(job: Job) {
  console.log('\n🎴 Building feed cards...');
  
  let totalCards = 0;
  
  for (const window of WINDOWS) {
    console.log(`\n  📊 Processing window: ${window}`);
    
    // Get newest events
    const recentEvents = await db.query.events.findMany({
      orderBy: desc(events.lastSeenAt),
      limit: 50,
    });
    
    console.log(`    Found ${recentEvents.length} recent events`);
    
    for (const event of recentEvents) {
      if (!event.primaryItemId) continue;
      
      // Get primary item
      const primaryItem = await db.query.items.findFirst({
        where: eq(items.id, event.primaryItemId),
      });
      
      if (!primaryItem) continue;
      
      // Determine "why it matters" based on tier and related count
      let why = '';
      if (primaryItem.tier === 'clippers') {
        if (event.relatedCount >= 5) {
          why = 'Clip spike driving momentum.';
        } else if (event.relatedCount >= 3) {
          why = 'Multiple clippers picked this up.';
        } else {
          why = 'New clip gaining traction.';
        }
      } else if (primaryItem.tier === 'weekly_wrap') {
        why = 'Weekly recap consolidating the storyline.';
      } else {
        why = 'Community activity detected.';
      }
      
      try {
        // Build meta object
        const meta = {
          author: primaryItem.author || primaryItem.channelTitle || 'Unknown',
          channel: primaryItem.channelTitle || '',
          timestamp: primaryItem.publishedAt.toISOString(),
          platform: primaryItem.platform,
        };
        
        // Upsert feed card
        await db.insert(feedCards)
          .values({
            window,
            eventId: event.id,
            primaryItemId: primaryItem.id,
            source: primaryItem.platform,
            tier: primaryItem.tier,
            title: primaryItem.title || 'Untitled',
            meta: JSON.stringify(meta),
            why,
            url: primaryItem.url,
            relatedCount: event.relatedCount,
            entityIds: [], // TODO: Link to entities when entity matching is implemented
            computedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [feedCards.window, feedCards.eventId],
            set: {
              title: primaryItem.title || 'Untitled',
              meta: JSON.stringify(meta),
              relatedCount: event.relatedCount,
              computedAt: new Date(),
            },
          });
        
        totalCards++;
        
      } catch (error: any) {
        console.error(`      ❌ Failed to create feed card for event ${event.id}:`, error.message);
      }
    }
    
    console.log(`    ✅ Created/updated cards for ${window}`);
  }
  
  console.log(`\n✅ Feed cards build complete: ${totalCards} cards`);
  
  return { 
    totalCards,
    windows: WINDOWS.length
  };
}
