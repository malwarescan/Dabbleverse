import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { monetizationEvents, sourceAccounts } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

const MICROS_PER_DOLLAR = 1_000_000;

/** GET /api/live/recent — most recent Super Chat events across all channels */
export async function GET() {
  try {
    const limit = Math.min(parseInt(String(50)), 100);
    const events = await db
      .select({
        id: monetizationEvents.id,
        videoId: monetizationEvents.videoId,
        sourceAccountId: monetizationEvents.sourceAccountId,
        type: monetizationEvents.type,
        amountMicros: monetizationEvents.amountMicros,
        currency: monetizationEvents.currency,
        giftCount: monetizationEvents.giftCount,
        tier: monetizationEvents.tier,
        publishedAt: monetizationEvents.publishedAt,
        displayName: sourceAccounts.displayName,
        handle: sourceAccounts.handle,
      })
      .from(monetizationEvents)
      .innerJoin(sourceAccounts, eq(monetizationEvents.sourceAccountId, sourceAccounts.id))
      .orderBy(desc(monetizationEvents.publishedAt))
      .limit(limit);

    return NextResponse.json({
      events: events.map((e) => ({
        videoId: e.videoId,
        url: `https://www.youtube.com/watch?v=${e.videoId}`,
        channelName: e.displayName || e.handle,
        type: e.type,
        amountUsd: e.amountMicros / MICROS_PER_DOLLAR,
        amountMicros: e.amountMicros,
        currency: e.currency,
        giftCount: e.giftCount,
        tier: e.tier,
        publishedAt: e.publishedAt,
      })),
    });
  } catch (e) {
    console.error('Live recent error:', e);
    return NextResponse.json({ error: 'Failed to load recent', events: [] }, { status: 500 });
  }
}
