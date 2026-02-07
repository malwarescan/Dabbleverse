import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { youtubeQueue } from '../lib/jobs/youtubeQueue';

// Load .env.local explicitly
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function resolve() {
  console.log('🚀 Triggering resolve_channels job NOW...\n');
  
  try {
    const job = await youtubeQueue.add('resolve_channels', {}, {
      removeOnComplete: false, // Keep it so we can see logs
      removeOnFail: false,
    });
    
    console.log(`✅ Job added with ID: ${job.id}`);
    console.log('⏳ Waiting for job to complete (60s timeout)...\n');
    
    // Wait for job to complete
    const result = await job.waitUntilFinished(
      (await youtubeQueue.client).duplicate(), 
      60000
    );
    
    console.log('\n✅ Job completed!');
    console.log('Result:', JSON.stringify(result, null, 2));
    
  } catch (error: any) {
    console.error('\n❌ Job failed:', error.message);
  }
  
  process.exit(0);
}

resolve();
