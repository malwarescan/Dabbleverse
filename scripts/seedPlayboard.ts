import dotenv from 'dotenv';
import path from 'path';
import { db } from '../lib/db/index';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import {
  sourceAccounts,
  channelDailySuperchatRollups,
  streamSuperchatRollups,
} from '../lib/db/schema';
import { eq, and } from 'drizzle-orm';

const today = new Date().toISOString().slice(0, 10);
const MICROS = 1_000_000;

const CHANNEL_AMOUNTS = [
  { grossUsd: 1247.5, eventCount: 89, breakdown: { super_chat: { micros: 800_000_000, count: 45 }, super_sticker: { micros: 120_000_000, count: 22 }, membership_gift: { micros: 327_500_000, count: 12 } } },
  { grossUsd: 892.0, eventCount: 56, breakdown: { super_chat: { micros: 650_000_000, count: 38 }, member_milestone: { micros: 0, count: 18 } } },
  { grossUsd: 534.25, eventCount: 41, breakdown: { super_chat: { micros: 534_250_000, count: 41 } } },
  { grossUsd: 412.0, eventCount: 28, breakdown: { super_chat: { micros: 412_000_000, count: 28 } } },
  { grossUsd: 298.5, eventCount: 19, breakdown: { super_chat: { micros: 298_500_000, count: 19 } } },
];
const STREAM_AMOUNTS = [
  { grossUsd: 890.0, eventCount: 62, breakdown: { super_chat: { micros: 600_000_000, count: 35 }, super_sticker: { micros: 290_000_000, count: 27 } } },
  { grossUsd: 445.5, eventCount: 28, breakdown: { super_chat: { micros: 445_500_000, count: 28 } } },
];

async function seedPlayboard() {
  console.log('🎮 Seeding Playboard (channel + stream rollups for leader/character YouTube channels)...\n');

  const accounts = await db
    .select({ id: sourceAccounts.id, displayName: sourceAccounts.displayName, handle: sourceAccounts.handle })
    .from(sourceAccounts)
    .where(and(eq(sourceAccounts.platform, 'youtube'), eq(sourceAccounts.isActive, true)))
    .limit(10);

  if (accounts.length === 0) {
    console.error('❌ No YouTube source_accounts found. Run pnpm run seed:youtube first to add leader/character channels.');
    process.exit(1);
  }

  console.log(`Using ${accounts.length} leader/character channel(s).`);

  for (let i = 0; i < accounts.length; i++) {
    const acc = accounts[i];
    const r = CHANNEL_AMOUNTS[i % CHANNEL_AMOUNTS.length];
    const grossMicros = Math.round(r.grossUsd * MICROS);
    const name = acc.displayName || acc.handle || 'Channel';
    await db
      .insert(channelDailySuperchatRollups)
      .values({
        sourceAccountId: acc.id,
        date: today,
        grossAmountMicros: grossMicros,
        eventCount: r.eventCount,
        breakdown: r.breakdown as object,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [channelDailySuperchatRollups.sourceAccountId, channelDailySuperchatRollups.date],
        set: {
          grossAmountMicros: grossMicros,
          eventCount: r.eventCount,
          breakdown: r.breakdown as object,
          updatedAt: new Date(),
        },
      });
    console.log(`  ✅ Channel rollup: ${name} $${r.grossUsd}`);
  }

  for (let i = 0; i < Math.min(accounts.length, 5); i++) {
    const acc = accounts[i];
    const r = STREAM_AMOUNTS[i % STREAM_AMOUNTS.length];
    const grossMicros = Math.round(r.grossUsd * MICROS);
    const name = acc.displayName || acc.handle || 'Channel';
    const videoId = `seed-${acc.id.replace(/-/g, '').slice(0, 20)}`;
    await db
      .insert(streamSuperchatRollups)
      .values({
        videoId,
        sourceAccountId: acc.id,
        grossAmountMicros: grossMicros,
        eventCount: r.eventCount,
        breakdown: r.breakdown as object,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [streamSuperchatRollups.videoId],
        set: {
          grossAmountMicros: grossMicros,
          eventCount: r.eventCount,
          breakdown: r.breakdown as object,
          updatedAt: new Date(),
        },
      });
    console.log(`  ✅ Stream rollup: ${name} $${r.grossUsd}`);
  }

  console.log('\n🎉 Playboard seed done. /api/live/leaderboard and /playboard will now return real data.');
  process.exit(0);
}

seedPlayboard().catch((err) => {
  console.error('💥 Seed failed:', err);
  process.exit(1);
});
