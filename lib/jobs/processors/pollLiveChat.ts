import { Job } from 'bullmq';
import { google } from 'googleapis';
import { db } from '../../db/index';
import {
  liveStreams,
  monetizationEvents,
  channelDailySuperchatRollups,
  streamSuperchatRollups,
} from '../../db/schema';
import { eq, sql, gte, lt, and } from 'drizzle-orm';

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

const POLL_INTERVAL_MS = 5000;

/**
 * Poll live chat for one or all active streams; ingest Super Chat / Super Sticker events.
 */
export async function pollLiveChat(job: Job) {
  const { videoId: singleVideoId } = job.data as { videoId?: string };

  const activeStreams = singleVideoId
    ? await db.query.liveStreams.findMany({
        where: eq(liveStreams.videoId, singleVideoId),
        columns: {
          id: true,
          videoId: true,
          sourceAccountId: true,
          activeLiveChatId: true,
          nextPageToken: true,
          pollingIntervalMillis: true,
        },
      })
    : await db.query.liveStreams.findMany({
        where: eq(liveStreams.status, 'live'),
        columns: {
          id: true,
          videoId: true,
          sourceAccountId: true,
          activeLiveChatId: true,
          nextPageToken: true,
          pollingIntervalMillis: true,
        },
      });

  let totalNew = 0;

  for (const stream of activeStreams) {
    if (!stream.activeLiveChatId) continue;

    try {
      const res = await youtube.liveChatMessages.list({
        liveChatId: stream.activeLiveChatId,
        part: ['snippet', 'authorDetails'],
        pageToken: stream.nextPageToken ?? undefined,
      });

      const pollingInterval = res.data.pollingIntervalMillis ?? POLL_INTERVAL_MS;

      await db
        .update(liveStreams)
        .set({
          nextPageToken: res.data.nextPageToken ?? null,
          pollingIntervalMillis: pollingInterval,
          lastPolledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(liveStreams.videoId, stream.videoId));

      const items = res.data.items ?? [];
      let newEvents = 0;

      for (const item of items) {
        const snippet = item.snippet as Record<string, unknown> | undefined;
        const msgId = (item.id as string) ?? '';
        if (!msgId) continue;

        const publishedAt = snippet?.publishedAt ? new Date(snippet.publishedAt as string) : new Date();
        const authorChannelId = (item.authorDetails as { channelId?: string })?.channelId ?? '';

        let type: string;
        let amountMicros = 0;
        let currency = 'USD';
        let giftCount: number | null = null;
        let tier: string | null = null;

        const superChat = snippet?.superChatDetails as { amountMicros?: number; currency?: string } | undefined;
        const superSticker = snippet?.superStickerDetails as { amountMicros?: number; currency?: string } | undefined;
        const membershipGift = snippet?.membershipGiftingDetails as {
          amountMicros?: number;
          currency?: string;
          giftMembershipsCount?: number;
        } | undefined;
        const memberMilestone = snippet?.memberMilestoneChatDetails as { memberLevelName?: string } | undefined;
        const giftReceived = snippet?.giftMembershipReceivedDetails as { memberLevelName?: string } | undefined;

        if (superChat) {
          type = 'super_chat';
          amountMicros = superChat.amountMicros ?? 0;
          currency = superChat.currency ?? 'USD';
        } else if (superSticker) {
          type = 'super_sticker';
          amountMicros = superSticker.amountMicros ?? 0;
          currency = superSticker.currency ?? 'USD';
        } else if (membershipGift) {
          type = 'membership_gift';
          amountMicros = membershipGift.amountMicros ?? 0;
          currency = membershipGift.currency ?? 'USD';
          giftCount = membershipGift.giftMembershipsCount ?? null;
        } else if (memberMilestone) {
          type = 'member_milestone';
          tier = memberMilestone.memberLevelName ?? null;
          amountMicros = 0;
        } else if (giftReceived) {
          type = 'member_milestone';
          tier = giftReceived.memberLevelName ?? 'Gifted';
          amountMicros = 0;
        } else {
          continue;
        }

        try {
          await db
            .insert(monetizationEvents)
            .values({
              videoId: stream.videoId,
              sourceAccountId: stream.sourceAccountId,
              type,
              amountMicros,
              currency,
              giftCount,
              tier,
              publishedAt,
              authorChannelId,
              messageId: msgId,
              rawPayload: item as object,
            })
            .onConflictDoNothing({
              target: [monetizationEvents.messageId],
            });
          newEvents++;
        } catch (_) {
          // duplicate or constraint
        }
      }

      if (newEvents > 0) totalNew += newEvents;
      // Always update rollups so live streams show on Playboard even with $0 (otherwise they only appear after first Super Chat)
      await updateRollups(stream.videoId, stream.sourceAccountId);

      await new Promise((r) => setTimeout(r, Math.max(100, pollingInterval - 100)));
    } catch (err: unknown) {
      const msg = (err as Error).message;
      if (msg.includes('404') || msg.includes('disabled') || msg.includes('live chat')) {
        await db
          .update(liveStreams)
          .set({ status: 'ended', updatedAt: new Date() })
          .where(eq(liveStreams.videoId, stream.videoId));
        console.log(`  ⏹ Stream ended or chat disabled: ${stream.videoId}`);
      } else {
        console.error(`  ❌ Poll error ${stream.videoId}:`, msg);
      }
    }
  }

  return { streamsPolled: activeStreams.length, newEvents: totalNew };
}

type Breakdown = Record<string, { micros: number; count: number }>;

async function getStreamBreakdown(videoId: string): Promise<{ gross: number; count: number; breakdown: Breakdown }> {
  const rows = await db
    .select({
      type: monetizationEvents.type,
      micros: sql<number>`COALESCE(SUM(amount_micros), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(monetizationEvents)
    .where(eq(monetizationEvents.videoId, videoId))
    .groupBy(monetizationEvents.type);

  const breakdown: Breakdown = {};
  let gross = 0;
  let count = 0;
  for (const r of rows) {
    breakdown[r.type] = { micros: Number(r.micros), count: Number(r.count) };
    gross += Number(r.micros);
    count += Number(r.count);
  }
  return { gross, count, breakdown };
}

async function getChannelDayBreakdown(
  sourceAccountId: string,
  dayStart: Date,
  dayEnd: Date
): Promise<{ gross: number; count: number; breakdown: Breakdown }> {
  const rows = await db
    .select({
      type: monetizationEvents.type,
      micros: sql<number>`COALESCE(SUM(amount_micros), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(monetizationEvents)
    .where(
      and(
        eq(monetizationEvents.sourceAccountId, sourceAccountId),
        gte(monetizationEvents.publishedAt, dayStart),
        lt(monetizationEvents.publishedAt, dayEnd)
      )
    )
    .groupBy(monetizationEvents.type);

  const breakdown: Breakdown = {};
  let gross = 0;
  let count = 0;
  for (const r of rows) {
    breakdown[r.type] = { micros: Number(r.micros), count: Number(r.count) };
    gross += Number(r.micros);
    count += Number(r.count);
  }
  return { gross, count, breakdown };
}

async function updateRollups(videoId: string, sourceAccountId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const dayStart = new Date(today + 'T00:00:00.000Z');
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const streamData = await getStreamBreakdown(videoId);
  const channelData = await getChannelDayBreakdown(sourceAccountId, dayStart, dayEnd);

  await db
    .insert(streamSuperchatRollups)
    .values({
      videoId,
      sourceAccountId,
      grossAmountMicros: streamData.gross,
      eventCount: streamData.count,
      breakdown: streamData.breakdown as object,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [streamSuperchatRollups.videoId],
      set: {
        grossAmountMicros: streamData.gross,
        eventCount: streamData.count,
        breakdown: streamData.breakdown as object,
        updatedAt: new Date(),
      },
    });

  await db
    .insert(channelDailySuperchatRollups)
    .values({
      sourceAccountId,
      date: today,
      grossAmountMicros: channelData.gross,
      eventCount: channelData.count,
      breakdown: channelData.breakdown as object,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [channelDailySuperchatRollups.sourceAccountId, channelDailySuperchatRollups.date],
      set: {
        grossAmountMicros: channelData.gross,
        eventCount: channelData.count,
        breakdown: channelData.breakdown as object,
        updatedAt: new Date(),
      },
    });
}
