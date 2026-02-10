import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import { db } from '../lib/db/index';
import { sourceAccounts } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function seedWatchlist() {
  console.log('🎬 Seeding YouTube watchlist...\n');
  
  const watchlistPath = path.join(process.cwd(), 'seed/watchlists/youtube.json');
  
  if (!fs.existsSync(watchlistPath)) {
    console.error('❌ youtube.json not found at:', watchlistPath);
    process.exit(1);
  }
  
  const watchlist = JSON.parse(fs.readFileSync(watchlistPath, 'utf-8'));
  
  let totalSeeded = 0;
  
  for (const [tier, urls] of Object.entries(watchlist.tiers) as [string, string[]][]) {
    console.log(`\n📁 Processing tier: ${tier}`);
    
    for (const url of urls) {
      // Extract handle from URL: https://www.youtube.com/@Handle → @Handle
      const handleMatch = url.match(/@([^/]+)/);
      const handle = handleMatch ? handleMatch[1] : null;
      
      if (!handle) {
        console.log(`  ⚠️  Could not extract handle from: ${url}`);
        continue;
      }
      
      try {
        // Upsert into source_accounts
        await db.insert(sourceAccounts)
          .values({
            platform: 'youtube',
            tier: tier as 'clippers' | 'weekly_wrap' | 'main',
            sourceUrl: url,
            handle: handle,
            isActive: true,
          })
          .onConflictDoUpdate({
            target: [sourceAccounts.sourceUrl],
            set: {
              tier: tier as 'clippers' | 'weekly_wrap' | 'main',
              isActive: true,
              updatedAt: new Date(),
            },
          });
        
        console.log(`  ✅ Seeded ${tier}: @${handle}`);
        totalSeeded++;
        
      } catch (error) {
        console.error(`  ❌ Failed to seed @${handle}:`, error);
      }
    }
  }
  
  console.log(`\n🎉 Successfully seeded ${totalSeeded} YouTube channels!`);
  
  // Show summary
  const clippers = await db.select().from(sourceAccounts).where(eq(sourceAccounts.tier, 'clippers'));
  const weekly = await db.select().from(sourceAccounts).where(eq(sourceAccounts.tier, 'weekly_wrap'));
  const main = await db.select().from(sourceAccounts).where(eq(sourceAccounts.tier, 'main'));
  
  console.log(`\n📊 Summary:`);
  console.log(`  Clippers: ${clippers.length}`);
  console.log(`  Weekly Wrap: ${weekly.length}`);
  console.log(`  Main (character channels): ${main.length}`);
  console.log(`  Total: ${clippers.length + weekly.length + main.length}`);
  
  process.exit(0);
}

seedWatchlist().catch((error) => {
  console.error('💥 Seed failed:', error);
  process.exit(1);
});
