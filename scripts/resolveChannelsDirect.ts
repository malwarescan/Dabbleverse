/**
 * Resolve YouTube channel IDs for all seeded accounts (no worker required).
 * Run after seed:youtube so detect_live_streams can find channels.
 * Requires DATABASE_URL and YOUTUBE_API_KEY in .env.local.
 */
import dotenv from 'dotenv';
import path from 'path';
import { resolveChannels } from '../lib/jobs/processors/resolveChannels';
import type { Job } from 'bullmq';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const fakeJob = { id: 'direct', data: {} } as Job;

async function main() {
  if (!process.env.YOUTUBE_API_KEY) {
    console.error('❌ YOUTUBE_API_KEY is required. Add it to .env.local');
    process.exit(1);
  }
  await resolveChannels(fakeJob);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
