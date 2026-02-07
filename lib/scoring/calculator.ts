import { WindowType, DriverLabel, SourcesBreakdown } from '@/lib/types';

/**
 * Time window definitions (in milliseconds)
 */
export const WINDOW_DURATIONS: Record<WindowType, number> = {
  now: 6 * 60 * 60 * 1000, // 6 hours
  '24h': 24 * 60 * 60 * 1000, // 24 hours
  '7d': 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Momentum comparison slices (equal halves)
 */
export const MOMENTUM_SLICES: Record<WindowType, number> = {
  now: 3 * 60 * 60 * 1000, // 3 hours
  '24h': 12 * 60 * 60 * 1000, // 12 hours
  '7d': 24 * 60 * 60 * 1000, // 24 hours
};

/**
 * Micro-momentum window (for "heating up" flag)
 */
export const MICRO_MOMENTUM_DURATION = 60 * 60 * 1000; // 60 minutes

/**
 * Platform weights (can be tuned)
 */
export const PLATFORM_WEIGHTS: SourcesBreakdown = {
  youtube: 1.0,
  reddit: 1.0,
  x: 0.0, // Phase 3
};

export interface PlatformMetrics {
  viewVelocity?: number;
  likeVelocity?: number;
  commentVelocity?: number;
  upvoteVelocity?: number;
  repostVelocity?: number;
  replyVelocity?: number;
  channelWeight?: number;
  accountWeight?: number;
}

export interface EntityMetrics {
  youtube: PlatformMetrics;
  reddit: PlatformMetrics;
  x: PlatformMetrics;
}

/**
 * Calculate normalized engagement velocity score per platform (0-100)
 */
export function calculatePlatformScore(
  platform: 'youtube' | 'reddit' | 'x',
  metrics: PlatformMetrics
): number {
  let score = 0;

  switch (platform) {
    case 'youtube':
      score =
        (metrics.viewVelocity || 0) * 0.4 +
        (metrics.likeVelocity || 0) * 0.3 +
        (metrics.commentVelocity || 0) * 0.3;
      score *= metrics.channelWeight || 1.0;
      break;

    case 'reddit':
      score =
        (metrics.upvoteVelocity || 0) * 0.5 +
        (metrics.commentVelocity || 0) * 0.5;
      break;

    case 'x':
      score =
        (metrics.repostVelocity || 0) * 0.4 +
        (metrics.likeVelocity || 0) * 0.3 +
        (metrics.replyVelocity || 0) * 0.3;
      score *= metrics.accountWeight || 1.0;
      break;
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Combine platform scores using weights
 */
export function calculateEntityScore(metrics: EntityMetrics): {
  score: number;
  sources: SourcesBreakdown;
} {
  const youtubeScore = calculatePlatformScore('youtube', metrics.youtube);
  const redditScore = calculatePlatformScore('reddit', metrics.reddit);
  const xScore = calculatePlatformScore('x', metrics.x);

  const totalWeight =
    PLATFORM_WEIGHTS.youtube + PLATFORM_WEIGHTS.reddit + PLATFORM_WEIGHTS.x;

  const weightedScore =
    (youtubeScore * PLATFORM_WEIGHTS.youtube +
      redditScore * PLATFORM_WEIGHTS.reddit +
      xScore * PLATFORM_WEIGHTS.x) /
    totalWeight;

  // Calculate source breakdown (normalized 0-1)
  const total = youtubeScore + redditScore + xScore;
  const sources: SourcesBreakdown = {
    youtube: total > 0 ? youtubeScore / total : 0,
    reddit: total > 0 ? redditScore / total : 0,
    x: total > 0 ? xScore / total : 0,
  };

  return {
    score: weightedScore,
    sources,
  };
}

/**
 * Calculate momentum (velocity comparison between time slices)
 */
export function calculateMomentum(
  currentSliceScore: number,
  priorSliceScore: number
): number {
  if (priorSliceScore === 0) {
    return currentSliceScore > 0 ? 100 : 0;
  }

  return ((currentSliceScore - priorSliceScore) / priorSliceScore) * 100;
}

/**
 * Classify driver based on metrics and sources
 */
export function classifyDriver(
  sources: SourcesBreakdown,
  momentum: number,
  microMomentum: number,
  eventCount: number,
  previousRank: number | null,
  currentRank: number,
  window: WindowType
): DriverLabel | null {
  // Clip Spike: YouTube-heavy, high momentum
  if (sources.youtube > 0.6 && momentum > 50 && window === 'now') {
    return 'clip_spike';
  }

  // Dunk Thread: X-heavy (Phase 3)
  if (sources.x > 0.6 && momentum > 40) {
    return 'dunk_thread';
  }

  // Reddit Consolidation: Reddit-heavy, many events
  if (sources.reddit > 0.6 && eventCount > 10) {
    return 'reddit_consolidation';
  }

  // Cross-platform Pickup: balanced across platforms
  const maxSource = Math.max(sources.youtube, sources.reddit, sources.x);
  if (maxSource < 0.5 && momentum > 30) {
    return 'cross_platform_pickup';
  }

  // Comeback: re-entry to top ranks
  if (previousRank === null || previousRank > 20) {
    if (currentRank <= 10) {
      return 'comeback';
    }
  }

  // Heating Up: micro-momentum flag
  if (microMomentum > 50 && momentum > 20) {
    return 'heating_up';
  }

  // Slow Burn: 7d window, steady growth
  if (window === '7d' && momentum > 0 && momentum < 20) {
    return 'slow_burn';
  }

  return null;
}

/**
 * Normalize scores to 0-100 percentile rank
 */
export function normalizeToPercentile(scores: number[]): number[] {
  const sorted = [...scores].sort((a, b) => b - a);
  return scores.map((score) => {
    const rank = sorted.indexOf(score);
    return ((sorted.length - rank) / sorted.length) * 100;
  });
}
