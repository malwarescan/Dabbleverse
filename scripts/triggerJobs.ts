import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { triggerJob } from '../lib/jobs/youtubeQueue';

// Load .env.local explicitly
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function trigger() {
  console.log('🚀 Manually triggering YouTube jobs...\n');
  
  try {
    // 1. Resolve channels first
    console.log('1️⃣ Triggering: resolve_channels');
    await triggerJob('resolve_channels');
    
    // Wait for resolution to complete
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // 2. Pull uploads for clippers
    console.log('\n2️⃣ Triggering: pull_uploads (clippers)');
    await triggerJob('pull_uploads', { tier: 'clippers' });
    
    // 3. Pull uploads for weekly_wrap
    console.log('3️⃣ Triggering: pull_uploads (weekly_wrap)');
    await triggerJob('pull_uploads', { tier: 'weekly_wrap' });
    
    // Wait for uploads to complete
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    // 4. Dedupe events
    console.log('\n4️⃣ Triggering: dedupe_events');
    await triggerJob('dedupe_events');
    
    // 5. Build feed cards
    console.log('5️⃣ Triggering: build_feed_cards');
    await triggerJob('build_feed_cards');
    
    console.log('\n✅ All jobs triggered! Check worker logs for progress.');
    
  } catch (error) {
    console.error('❌ Failed to trigger jobs:', error);
  }
  
  process.exit(0);
}

trigger();
