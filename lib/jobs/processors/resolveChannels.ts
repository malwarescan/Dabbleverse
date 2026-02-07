import { Job } from 'bullmq';
import { google } from 'googleapis';
import { db } from '../../db/index';
import { sourceAccounts } from '../../db/schema';
import { eq, and, isNull } from 'drizzle-orm';

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

export async function resolveChannels(job: Job) {
  console.log('\n🔍 Resolving YouTube channels...');
  
  // Get all unresolved channels (no channel_id yet)
  const unresolved = await db.query.sourceAccounts.findMany({
    where: and(
      eq(sourceAccounts.platform, 'youtube'),
      isNull(sourceAccounts.channelId)
    ),
  });
  
  console.log(`  Found ${unresolved.length} unresolved channels`);
  
  let resolvedCount = 0;
  
  for (const account of unresolved) {
    if (!account.handle) {
      console.log(`  ⚠️  Skipping ${account.sourceUrl} (no handle)`);
      continue;
    }
    
    try {
      console.log(`  🔎 Searching for: @${account.handle}`);
      
      // Search for channel by handle
      const response = await youtube.search.list({
        part: ['snippet'],
        type: ['channel'],
        q: account.handle,
        maxResults: 5,
      });
      
      const channels = response.data.items || [];
      
      if (channels.length === 0) {
        console.log(`    ❌ No results found for @${account.handle}`);
        continue;
      }
      
      // Pick best match (first result that contains handle in title, or just first result)
      const match = channels.find(ch => 
        ch.snippet?.channelTitle?.toLowerCase().includes(account.handle!.toLowerCase())
      ) || channels[0];
      
      if (match && match.snippet?.channelId) {
        await db.update(sourceAccounts)
          .set({
            channelId: match.snippet.channelId,
            displayName: match.snippet.channelTitle || account.handle,
            lastResolvedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(sourceAccounts.id, account.id));
        
        console.log(`    ✅ Resolved: ${match.snippet.channelTitle} (${match.snippet.channelId})`);
        resolvedCount++;
      }
      
      // Rate limit: wait 100ms between searches to avoid hitting quota
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error: any) {
      console.error(`    ❌ Failed to resolve @${account.handle}:`, error.message);
    }
  }
  
  console.log(`\n✅ Resolved ${resolvedCount}/${unresolved.length} channels`);
  
  return { 
    total: unresolved.length,
    resolved: resolvedCount 
  };
}
