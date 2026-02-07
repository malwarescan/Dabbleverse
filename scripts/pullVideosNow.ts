import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { youtubeQueue } from '../lib/jobs/youtubeQueue';

// Load .env.local explicitly
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function pullVideos() {
  console.log('🎬 Triggering pull_uploads jobs NOW...\n');
  
  try {
    // Trigger clippers tier
    console.log('1️⃣ Triggering pull_uploads for CLIPPERS tier...');
    const job1 = await youtubeQueue.add('pull_uploads', { tier: 'clippers' }, {
      removeOnComplete: false,
      removeOnFail: false,
    });
    console.log(`   ✅ Job added with ID: ${job1.id}\n`);
    
    // Trigger weekly_wrap tier
    console.log('2️⃣ Triggering pull_uploads for WEEKLY_WRAP tier...');
    const job2 = await youtubeQueue.add('pull_uploads', { tier: 'weekly_wrap' }, {
      removeOnComplete: false,
      removeOnFail: false,
    });
    console.log(`   ✅ Job added with ID: ${job2.id}\n`);
    
    console.log('⏳ Jobs queued! Check worker logs for progress...');
    console.log('   (This may take 30-60 seconds to complete)\n');
    
  } catch (error: any) {
    console.error('\n❌ Failed to trigger jobs:', error.message);
  }
  
  process.exit(0);
}

pullVideos();
