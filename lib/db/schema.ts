import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, real, index, uniqueIndex, boolean, pgEnum } from 'drizzle-orm/pg-core';

// Enums
export const entityTypeEnum = pgEnum('entity_type', ['character', 'storyline', 'show', 'chatter', 'clipper']);
export const platformEnum = pgEnum('platform', ['youtube', 'reddit', 'x']);
export const windowEnum = pgEnum('window', ['now', '24h', '7d']);
export const matchTypeEnum = pgEnum('match_type', ['exact', 'contains', 'regex', 'handle']);
export const tierEnum = pgEnum('tier', ['clippers', 'weekly_wrap']);
export const driverLabelEnum = pgEnum('driver_label', [
  'clip_spike',
  'dunk_thread',
  'reddit_consolidation',
  'cross_platform_pickup',
  'comeback',
  'slow_burn',
  'heating_up',
  'breakout',
  'dominating',
  'volatile'
]);

// Source Accounts table (YouTube channels we watch)
export const sourceAccounts = pgTable('source_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  platform: text('platform').notNull().default('youtube'),
  tier: tierEnum('tier').notNull(),
  sourceUrl: text('source_url').notNull(),
  handle: text('handle'),
  channelId: text('channel_id'),
  displayName: text('display_name'),
  isActive: boolean('is_active').default(true).notNull(),
  lastResolvedAt: timestamp('last_resolved_at', { withTimezone: true }),
  lastIngestedAt: timestamp('last_ingested_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  platformChannelIdx: uniqueIndex('source_accounts_platform_channel_idx').on(table.platform, table.channelId),
  tierActiveIdx: index('source_accounts_tier_active_idx').on(table.tier, table.isActive),
  sourceUrlIdx: uniqueIndex('source_accounts_source_url_idx').on(table.sourceUrl),
}));

// Entities table
export const entities = pgTable('entities', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: entityTypeEnum('type').notNull(),
  canonicalName: varchar('canonical_name', { length: 255 }).notNull(),
  description: text('description'),
  enabled: boolean('enabled').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  typeIdx: index('entities_type_idx').on(table.type),
  enabledIdx: index('entities_enabled_idx').on(table.enabled),
}));

// Entity Aliases table
export const entityAliases = pgTable('entity_aliases', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  aliasText: varchar('alias_text', { length: 255 }).notNull(),
  matchType: matchTypeEnum('match_type').notNull(),
  platformScope: varchar('platform_scope', { length: 50 }).default('any').notNull(), // 'youtube', 'reddit', 'x', 'any'
  confidenceWeight: real('confidence_weight').default(1.0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  entityIdIdx: index('entity_aliases_entity_id_idx').on(table.entityId),
  aliasTextIdx: index('entity_aliases_alias_text_idx').on(table.aliasText),
  uniqueAlias: uniqueIndex('entity_aliases_unique').on(table.entityId, table.aliasText, table.platformScope),
}));

// Items table (raw content from platforms)
export const items = pgTable('items', {
  id: uuid('id').primaryKey().defaultRandom(),
  platform: platformEnum('platform').notNull(),
  tier: tierEnum('tier'),
  sourceAccountId: uuid('source_account_id').references(() => sourceAccounts.id),
  platformItemId: varchar('platform_item_id', { length: 255 }).notNull(),
  url: text('url').notNull(),
  title: text('title'),
  content: text('content'),
  author: varchar('author', { length: 255 }),
  channelId: text('channel_id'),
  channelTitle: text('channel_title'),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
  durationSeconds: integer('duration_seconds'),
  metricsSnapshot: jsonb('metrics_snapshot').notNull(), // {views, likes, comments, etc}
  rawPayload: jsonb('raw_payload'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  platformItemIdIdx: uniqueIndex('items_platform_item_id_unique').on(table.platform, table.platformItemId),
  publishedAtIdx: index('items_published_at_idx').on(table.publishedAt),
  platformIdx: index('items_platform_idx').on(table.platform),
  sourceAccountIdx: index('items_source_account_idx').on(table.sourceAccountId),
  tierIdx: index('items_tier_idx').on(table.tier),
}));

// Item Metric Snapshots table (time series stats for velocity calculation)
export const itemMetricSnapshots = pgTable('item_metric_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: uuid('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  capturedAt: timestamp('captured_at', { withTimezone: true }).defaultNow().notNull(),
  views: integer('views').default(0),
  likes: integer('likes').default(0),
  comments: integer('comments').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  itemCapturedIdx: index('item_metric_snapshots_item_captured_idx').on(table.itemId, table.capturedAt),
}));

// Events table (deduped clusters of items)
export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventKey: varchar('event_key', { length: 64 }).notNull().unique(), // hash for deduplication
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
  primaryItemId: uuid('primary_item_id').references(() => items.id),
  platformMix: jsonb('platform_mix').notNull(), // {youtube: true, reddit: true, x: false}
  eventTitle: text('event_title').notNull(),
  eventSummary: text('event_summary'),
  itemCount: integer('item_count').default(1).notNull(),
  relatedCount: integer('related_count').default(1).notNull(), // Number of related items
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  eventKeyIdx: uniqueIndex('events_event_key_idx').on(table.eventKey),
  firstSeenAtIdx: index('events_first_seen_at_idx').on(table.firstSeenAt),
  lastSeenAtIdx: index('events_last_seen_at_idx').on(table.lastSeenAt),
}));

// Event Items junction table
export const eventItems = pgTable('event_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  itemId: uuid('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  eventIdIdx: index('event_items_event_id_idx').on(table.eventId),
  itemIdIdx: index('event_items_item_id_idx').on(table.itemId),
  uniqueEventItem: uniqueIndex('event_items_unique').on(table.eventId, table.itemId),
}));

// Event Entity Links table
export const eventEntityLinks = pgTable('event_entity_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  evidence: jsonb('evidence'), // {item_ids: [], snippets: []}
  confidence: real('confidence').default(1.0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  eventIdIdx: index('event_entity_links_event_id_idx').on(table.eventId),
  entityIdIdx: index('event_entity_links_entity_id_idx').on(table.entityId),
  uniqueLink: uniqueIndex('event_entity_links_unique').on(table.eventId, table.entityId),
}));

// Scores table (time-windowed snapshots for fast reads)
export const scores = pgTable('scores', {
  id: uuid('id').primaryKey().defaultRandom(),
  window: windowEnum('window').notNull(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  rank: integer('rank').notNull(),
  score: real('score').notNull(), // 0-100
  momentum: real('momentum').notNull(), // percentage change
  microMomentum: real('micro_momentum'), // 60m vs 60m for "heating up" flag
  deltaRank: integer('delta_rank').notNull().default(0), // change in rank position
  sourcesBreakdown: jsonb('sources_breakdown').notNull(), // {youtube: 0.6, reddit: 0.4, x: 0}
  driverLabel: driverLabelEnum('driver_label'),
  eventCount: integer('event_count').default(0).notNull(),
  computedAt: timestamp('computed_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  windowEntityIdx: uniqueIndex('scores_window_entity_unique').on(table.window, table.entityId, table.computedAt),
  windowRankIdx: index('scores_window_rank_idx').on(table.window, table.rank),
  computedAtIdx: index('scores_computed_at_idx').on(table.computedAt),
}));

// Feed Cards table (precomputed ticker output)
export const feedCards = pgTable('feed_cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  window: windowEnum('window').notNull(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  primaryItemId: uuid('primary_item_id').notNull().references(() => items.id),
  source: platformEnum('source').notNull(),
  tier: tierEnum('tier'),
  title: text('title').notNull(),
  meta: text('meta').notNull(), // "Channel Name • 2h ago"
  why: text('why').notNull(), // "why it matters" context line
  url: text('url').notNull(),
  relatedCount: integer('related_count').default(1).notNull(),
  entityIds: jsonb('entity_ids').notNull(), // array of linked entity IDs
  computedAt: timestamp('computed_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  windowComputedIdx: index('feed_cards_window_computed_idx').on(table.window, table.computedAt),
  eventIdIdx: index('feed_cards_event_id_idx').on(table.eventId),
  windowEventIdx: uniqueIndex('feed_cards_window_event_idx').on(table.window, table.eventId),
}));

// Watchlists table (configurable channel/sub lists)
export const watchlists = pgTable('watchlists', {
  id: uuid('id').primaryKey().defaultRandom(),
  platform: platformEnum('platform').notNull(),
  identifier: varchar('identifier', { length: 255 }).notNull(), // channel ID or subreddit name
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(), // 'core_show', 'clipper', 'primary', 'adjacent'
  weight: real('weight').default(1.0).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  metadata: jsonb('metadata'), // extra config per platform
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  platformIdentifierIdx: uniqueIndex('watchlists_platform_identifier_unique').on(table.platform, table.identifier),
  enabledIdx: index('watchlists_enabled_idx').on(table.enabled),
}));

// Job Queue Status table (for monitoring)
export const jobQueueStatus = pgTable('job_queue_status', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobType: varchar('job_type', { length: 100 }).notNull(),
  status: varchar('status', { length: 50 }).notNull(), // 'running', 'completed', 'failed'
  startedAt: timestamp('started_at').notNull(),
  completedAt: timestamp('completed_at'),
  metadata: jsonb('metadata'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  jobTypeIdx: index('job_queue_status_job_type_idx').on(table.jobType),
  statusIdx: index('job_queue_status_status_idx').on(table.status),
  startedAtIdx: index('job_queue_status_started_at_idx').on(table.startedAt),
}));
