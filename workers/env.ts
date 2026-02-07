// Load environment variables BEFORE any other imports
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local from project root
const envPath = path.resolve(__dirname, '../.env.local');
dotenv.config({ path: envPath });

console.log('🔧 Environment loaded:', {
  DATABASE_URL: process.env.DATABASE_URL?.substring(0, 30) + '...',
  REDIS_URL: process.env.REDIS_URL,
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY?.substring(0, 20) + '...',
});
