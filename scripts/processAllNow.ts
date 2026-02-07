import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dedupeQueue, feedQueue } from '../lib/jobs/youtubeQueue';

// Load .env.local explicitly
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function processAll() {
  console.log('🔄 Triggering deduplication and feed generation...\n');
  
  try {
    // Trigger dedupe
    console.log('1️⃣ Triggering dedupe_events...');
    const job1 = await dedupeQueue.add('dedupe_events', {}, {
      removeOnComplete: false,
      removeOnFail: false,
    });
    console.log(`   ✅ Job added with ID: ${job1.id}\n`);
    
    // Wait a bit for dedupe to complete
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Trigger feed cards
    console.log('2️⃣ Triggering build_feed_cards...');
    const job2 = await feedQueue.add('build_feed_cards', {}, {
      removeOnComplete: false,
      removeOnFail: false,
    });
    console.log(`   ✅ Job added with ID: ${job2.id}\n`);
    
    console.log('⏳ Jobs queued! Waiting for completion...\n');
    
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    console.log('✅ Processing complete! Check your dashboard now!');
    
  } catch (error: any) {
    console.error('\n❌ Failed to trigger jobs:', error.message);
  }
  
  process.exit(0);
}

processAll();
