import { clsx } from 'clsx';
import { PlatformType } from '@/lib/types';

interface SourceBadgeProps {
  platform: PlatformType;
  className?: string;
}

export function SourceBadge({ platform, className }: SourceBadgeProps) {
  const styles = {
    youtube: {
      backgroundColor: 'var(--color-source-youtube-muted)',
      color: 'var(--color-source-youtube)',
    },
    reddit: {
      backgroundColor: 'var(--color-source-reddit-muted)',
      color: 'var(--color-source-reddit)',
    },
    x: {
      backgroundColor: 'var(--color-source-x-muted)',
      color: 'var(--color-source-x)',
    },
  };

  return (
    <span
      className={clsx('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', className)}
      style={styles[platform]}
    >
      {platform === 'youtube' && 'YouTube'}
      {platform === 'reddit' && 'Reddit'}
      {platform === 'x' && 'X'}
    </span>
  );
}

interface MomentumBadgeProps {
  momentum: number;
  microMomentum?: number;
  className?: string;
}

export function MomentumBadge({ momentum, microMomentum, className }: MomentumBadgeProps) {
  const isUp = momentum > 0;
  const isDown = momentum < 0;
  const isHeatingUp = microMomentum !== undefined && microMomentum > 50;

  const getStyle = () => {
    if (isUp) return { backgroundColor: 'var(--color-momentum-up-muted)', color: 'var(--color-momentum-up)' };
    if (isDown) return { backgroundColor: 'var(--color-momentum-down-muted)', color: 'var(--color-momentum-down)' };
    return { backgroundColor: 'var(--color-broadcast-border)', color: 'var(--color-momentum-neutral)' };
  };

  return (
    <div className="flex items-center gap-1">
      <span
        className={clsx('inline-flex items-center px-2 py-0.5 rounded text-sm font-bold tabular-nums', className)}
        style={getStyle()}
      >
        {isUp && '▲'}
        {isDown && '▼'}
        {!isUp && !isDown && '—'}
        {' '}
        {Math.abs(momentum).toFixed(1)}%
      </span>
      {isHeatingUp && (
        <span className="text-xs" style={{ color: 'var(--color-momentum-up)' }}>🔥</span>
      )}
    </div>
  );
}

interface RankBadgeProps {
  rank: number;
  deltaRank: number;
  className?: string;
}

export function RankBadge({ rank, deltaRank, className }: RankBadgeProps) {
  const getStyle = () => {
    if (rank === 1) return { backgroundColor: 'rgba(255, 215, 0, 0.2)', color: 'var(--color-rank-gold)' };
    if (rank === 2) return { backgroundColor: 'rgba(192, 192, 192, 0.2)', color: 'var(--color-rank-silver)' };
    if (rank === 3) return { backgroundColor: 'rgba(205, 127, 50, 0.2)', color: 'var(--color-rank-bronze)' };
    return { backgroundColor: 'var(--color-broadcast-border)', color: 'var(--color-text-primary)' };
  };

  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <div 
        className="flex items-center justify-center w-10 h-10 rounded font-bold tabular-nums text-lg"
        style={getStyle()}
      >
        {rank}
      </div>
      {deltaRank !== 0 && (
        <span
          className="text-sm font-medium tabular-nums"
          style={{ color: deltaRank < 0 ? 'var(--color-momentum-up)' : 'var(--color-momentum-down)' }}
        >
          {deltaRank > 0 ? '▼' : '▲'} {Math.abs(deltaRank)}
        </span>
      )}
    </div>
  );
}

interface DriverLabelBadgeProps {
  label: string;
  className?: string;
}

export function DriverLabelBadge({ label, className }: DriverLabelBadgeProps) {
  return (
    <span 
      className={clsx('inline-flex items-center px-2 py-1 rounded text-xs font-medium uppercase tracking-wide', className)}
      style={{ backgroundColor: 'var(--color-broadcast-accent-muted)', color: 'var(--color-broadcast-accent)' }}
    >
      {label}
    </span>
  );
}
