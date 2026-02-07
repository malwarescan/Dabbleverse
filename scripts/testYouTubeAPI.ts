import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

// Load .env.local explicitly
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

async function testAPI() {
  console.log('🧪 Testing YouTube API...\n');
  console.log('API Key:', process.env.YOUTUBE_API_KEY?.substring(0, 20) + '...\n');
  
  try {
    // Test 1: Simple search
    console.log('Test 1: Searching for "@SoThoroughJoeBurrow"...');
    const response = await youtube.search.list({
      part: ['snippet'],
      type: ['channel'],
      q: 'SoThoroughJoeBurrow',
      maxResults: 3,
    });
    
    console.log(`  Found ${response.data.items?.length || 0} results`);
    
    response.data.items?.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.snippet?.channelTitle} (${item.snippet?.channelId})`);
    });
    
    console.log('\n✅ API test successful!');
  } catch (error: any) {
    console.error('\n❌ API test failed:', error.message);
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testAPI();
