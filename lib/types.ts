// API Response Types

export type WindowType = 'now' | '24h' | '7d';
export type EntityType = 'character' | 'storyline' | 'show' | 'chatter' | 'clipper';
export type PlatformType = 'youtube' | 'reddit' | 'x';
export type DriverLabel = 
  | 'clip_spike'
  | 'dunk_thread'
  | 'reddit_consolidation'
  | 'cross_platform_pickup'
  | 'comeback'
  | 'slow_burn'
  | 'heating_up'
  | 'breakout'
  | 'dominating'
  | 'volatile';

export interface SourcesBreakdown {
  youtube: number;
  reddit: number;
  x: number;
}

export interface ScoreboardRow {
  rank: number;
  deltaRank: number;
  entityId: string;
  name: string;
  type: EntityType;
  score: number;
  momentum: number;
  microMomentum?: number;
  sources: SourcesBreakdown;
  driver: DriverLabel | null;
  eventCount: number;
}

export interface ScoreboardResponse {
  computedAt: string;
  window: WindowType;
  rows: ScoreboardRow[];
}

export interface MoverCard {
  entityId: string;
  name: string;
  type: EntityType;
  momentum: number;
  microMomentum?: number;
  driver: DriverLabel | null;
  sources: SourcesBreakdown;
  receiptCount: number;
}

export interface MoversResponse {
  computedAt: string;
  window: WindowType;
  movers: MoverCard[];
}

export interface FeedCardData {
  id: string;
  source: PlatformType;
  title: string;
  meta: {
    author?: string;
    channel?: string;
    timestamp: string;
    platform: PlatformType;
  };
  why: string;
  url: string;
  eventId: string;
  entityIds: string[];
}

export interface FeedResponse {
  computedAt: string;
  window: WindowType;
  cards: FeedCardData[];
}

export interface EntityProfile {
  id: string;
  type: EntityType;
  canonicalName: string;
  description: string | null;
  enabled: boolean;
  aliases: string[];
}

// UI State Types

export interface TimeRange {
  label: string;
  value: WindowType;
}

export const TIME_RANGES: TimeRange[] = [
  { label: 'Now', value: 'now' },
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
];

// Driver Label Display Mappings

export const DRIVER_LABELS: Record<DriverLabel, string> = {
  clip_spike: 'Clip Spike',
  dunk_thread: 'Dunk Thread',
  reddit_consolidation: 'Reddit Consolidation',
  cross_platform_pickup: 'Cross-Platform Pickup',
  comeback: 'Comeback',
  slow_burn: 'Slow Burn',
  heating_up: 'Heating Up',
  breakout: 'Breakout',
  dominating: 'Dominating',
  volatile: 'Volatile',
};

// Platform Display Mappings

export const PLATFORM_LABELS: Record<PlatformType, string> = {
  youtube: 'YouTube',
  reddit: 'Reddit',
  x: 'X',
};
