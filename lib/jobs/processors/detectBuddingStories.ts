import { Job } from 'bullmq';
import { db } from '../../db/index';
import {
  items,
  entities,
  entityAliases,
  youtubeCommentSnippets,
  buddingStorylineSignals,
} from '../../db/schema';
import { eq, and, desc, sql, gt, inArray } from 'drizzle-orm';
import type { WindowType } from '@/lib/types';

const WINDOW_HOURS: Record<WindowType, number> = { now: 6, '24h': 24, '7d': 168 };
const MAX_SAMPLE_SNIPPETS = 3;

/**
 * Analyze YouTube comment snippets + video descriptions to detect storylines/entities
 * that are "budding" (mentioned frequently in recent discussion).
 */
export async function detectBuddingStories(job: Job) {
  const window: WindowType = (job.data?.window as WindowType) || '24h';
  const hours = WINDOW_HOURS[window];

  console.log(`\n🌱 Detecting budding stories (window=${window}, last ${hours}h)...`);

  // 1. Load entity aliases for storylines (and characters) we want to detect
  const storylineEntities = await db
    .select({
      entityId: entities.id,
      canonicalName: entities.canonicalName,
      aliasText: entityAliases.aliasText,
      matchType: entityAliases.matchType,
    })
    .from(entities)
    .innerJoin(entityAliases, eq(entities.id, entityAliases.entityId))
    .where(
      and(
        inArray(entities.type, ['storyline', 'character', 'show']),
        eq(entities.enabled, true)
      )
    );

  const aliasToEntity = new Map<string, { entityId: string; canonicalName: string }>();
  for (const row of storylineEntities) {
    const key = row.aliasText.toLowerCase().trim();
    if (key.length >= 2) {
      aliasToEntity.set(key, { entityId: row.entityId, canonicalName: row.canonicalName });
    }
  }
  console.log(`  Loaded ${aliasToEntity.size} aliases for ${storylineEntities.length} rows`);

  // 2. Recent comment snippets (last N hours)
  const commentRows = await db
    .select({
      text: youtubeCommentSnippets.text,
      likeCount: youtubeCommentSnippets.likeCount,
      publishedAt: youtubeCommentSnippets.publishedAt,
    })
    .from(youtubeCommentSnippets)
    .where(gt(youtubeCommentSnippets.publishedAt, new Date(Date.now() - hours * 60 * 60 * 1000)))
    .orderBy(desc(youtubeCommentSnippets.publishedAt));

  // 3. Recent video titles + descriptions (items.content)
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const itemRows = await db
    .select({
      title: items.title,
      content: items.content,
      publishedAt: items.publishedAt,
    })
    .from(items)
    .where(and(eq(items.platform, 'youtube'), gt(items.publishedAt, since)))
    .orderBy(desc(items.publishedAt));

  // 4. Count mentions per entity (case-insensitive contains)
  const entityMentions = new Map<
    string,
    { commentMentions: number; descriptionMentions: number; samples: { source: string; text: string }[] }
  >();

  function addMention(
    entityId: string,
    source: 'comment' | 'description',
    text: string,
    existing: { commentMentions: number; descriptionMentions: number; samples: { source: string; text: string }[] }
  ) {
    if (source === 'comment') {
      existing.commentMentions += 1;
    } else {
      existing.descriptionMentions += 1;
    }
    const snippet = text.slice(0, 120) + (text.length > 120 ? '…' : '');
    if (existing.samples.length < MAX_SAMPLE_SNIPPETS && !existing.samples.some((s) => s.text === snippet)) {
      existing.samples.push({ source, text: snippet });
    }
  }

  for (const row of commentRows) {
    const lower = (row.text || '').toLowerCase();
    for (const [alias, { entityId, canonicalName }] of aliasToEntity) {
      if (!lower.includes(alias)) continue;
      if (!entityMentions.has(entityId)) {
        entityMentions.set(entityId, {
          commentMentions: 0,
          descriptionMentions: 0,
          samples: [],
        });
      }
      addMention(entityId, 'comment', row.text || '', entityMentions.get(entityId)!);
    }
  }

  for (const row of itemRows) {
    const title = (row.title || '').toLowerCase();
    const desc = (row.content || '').toLowerCase();
    const combined = `${title} ${desc}`;
    for (const [alias, { entityId }] of aliasToEntity) {
      if (!combined.includes(alias)) continue;
      if (!entityMentions.has(entityId)) {
        entityMentions.set(entityId, {
          commentMentions: 0,
          descriptionMentions: 0,
          samples: [],
        });
      }
      addMention(entityId, 'description', row.title || row.content || '', entityMentions.get(entityId)!);
    }
  }

  const computedAt = new Date();

  // 5. Persist signals (clear previous for this window, then insert)
  await db.delete(buddingStorylineSignals).where(eq(buddingStorylineSignals.window, window));

  let inserted = 0;
  for (const [entityId, data] of entityMentions) {
    const total = data.commentMentions + data.descriptionMentions;
    if (total === 0) continue;
    await db.insert(buddingStorylineSignals).values({
      entityId,
      window,
      mentionCount: total,
      commentMentions: data.commentMentions,
      descriptionMentions: data.descriptionMentions,
      sampleSnippets: data.samples,
      computedAt,
    });
    inserted++;
  }

  console.log(`  ✅ Found ${entityMentions.size} entities with mentions; wrote ${inserted} budding signals`);
  return {
    window,
    hours,
    commentsAnalyzed: commentRows.length,
    videosAnalyzed: itemRows.length,
    entitiesWithMentions: entityMentions.size,
    signalsWritten: inserted,
  };
}
