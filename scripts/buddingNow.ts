/**
 * One-off: report which storylines/entities are budding from recent video titles + descriptions.
 * Run: npx tsx scripts/buddingNow.ts
 */
import 'dotenv/config';
import { db } from '../lib/db/index';
import { entities, entityAliases, items, youtubeCommentSnippets } from '../lib/db/schema';
import { eq, and, desc, gt, inArray } from 'drizzle-orm';

const HOURS = 24 * 7; // 7 days

async function main() {
  const since = new Date(Date.now() - HOURS * 60 * 60 * 1000);

  const storylineRows = await db
    .select({
      entityId: entities.id,
      canonicalName: entities.canonicalName,
      type: entities.type,
      aliasText: entityAliases.aliasText,
    })
    .from(entities)
    .innerJoin(entityAliases, eq(entities.id, entityAliases.entityId))
    .where(
      and(
        inArray(entities.type, ['storyline', 'character', 'show']),
        eq(entities.enabled, true)
      )
    );

  const aliasToEntity = new Map<string, { entityId: string; canonicalName: string; type: string }>();
  for (const row of storylineRows) {
    const key = row.aliasText.toLowerCase().trim();
    if (key.length >= 2) {
      aliasToEntity.set(key, {
        entityId: row.entityId,
        canonicalName: row.canonicalName,
        type: row.type,
      });
    }
  }

  const itemRows = await db
    .select({ title: items.title, content: items.content })
    .from(items)
    .where(and(eq(items.platform, 'youtube'), gt(items.publishedAt, since)));

  let commentRows: { text: string }[] = [];
  try {
    commentRows = await db
      .select({ text: youtubeCommentSnippets.text })
      .from(youtubeCommentSnippets)
      .where(gt(youtubeCommentSnippets.publishedAt, since));
  } catch {
    // table may not exist yet
  }

  const counts = new Map<
    string,
    { name: string; type: string; description: number; comments: number }
  >();

  function add(entityId: string, name: string, type: string, source: 'description' | 'comments') {
    if (!counts.has(entityId)) {
      counts.set(entityId, { name, type, description: 0, comments: 0 });
    }
    const c = counts.get(entityId)!;
    if (source === 'description') c.description++;
    else c.comments++;
  }

  for (const row of itemRows) {
    const text = ((row.title || '') + ' ' + (row.content || '')).toLowerCase();
    for (const [alias, { entityId, canonicalName, type }] of aliasToEntity) {
      if (!text.includes(alias)) continue;
      add(entityId, canonicalName, type, 'description');
    }
  }

  for (const row of commentRows) {
    const text = (row.text || '').toLowerCase();
    for (const [alias, { entityId, canonicalName, type }] of aliasToEntity) {
      if (!text.includes(alias)) continue;
      add(entityId, canonicalName, type, 'comments');
    }
  }

  const sorted = [...counts.entries()]
    .map(([_, v]) => ({ ...v, total: v.description + v.comments }))
    .filter((v) => v.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);

  console.log('\n🌱 Budding storylines / entities (last 7 days)\n');
  if (sorted.length === 0) {
    console.log('  No mentions yet.');
    console.log('  • Run db:push if you haven’t, then run the worker so pull_comments + detect_budding_stories run.');
    console.log('  • Ensure you have storylines/characters/shows and aliases seeded, and YouTube items ingested.\n');
    return;
  }
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    console.log(`  ${i + 1}. ${s.name} (${s.type}): ${s.total} mentions (descriptions: ${s.description}, comments: ${s.comments})`);
  }
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
