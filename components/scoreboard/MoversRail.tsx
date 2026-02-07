import { MoverCard } from '@/lib/types';
import { MomentumBadge, DriverLabelBadge } from '@/components/ui/Badge';
import { SourcePills } from '@/components/ui/SourcePills';
import { DRIVER_LABELS } from '@/lib/types';

interface MoversRailProps {
  movers: MoverCard[];
}

export function MoversRail({ movers }: MoversRailProps) {
  if (movers.length === 0) {
    return (
      <div className="broadcast-card p-broadcast-xl">
        <h2 className="text-broadcast-lg font-bold mb-broadcast-lg">What Moved</h2>
        <p className="text-text-tertiary text-center py-broadcast-xl">
          No significant movement
        </p>
      </div>
    );
  }

  // Split into rising (positive momentum) and falling (negative momentum)
  const rising = movers.filter(m => m.momentum > 0).sort((a, b) => b.momentum - a.momentum);
  const falling = movers.filter(m => m.momentum < 0).sort((a, b) => a.momentum - b.momentum);

  const renderMover = (mover: MoverCard, section: 'rising' | 'falling') => (
    <div
      key={`mover-${section}-${mover.entityId}`}
      className="p-3 rounded transition-colors duration-150 cursor-pointer"
      style={{
        backgroundColor: 'transparent',
        border: '1px solid transparent',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--color-broadcast-panel-hover)';
        e.currentTarget.style.borderColor = 'var(--color-broadcast-border)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.borderColor = 'transparent';
      }}
    >
      {/* Name */}
      <div className="text-sm font-semibold mb-1 truncate" style={{ color: 'var(--color-text-primary)' }}>
        {mover.name}
      </div>

      {/* Type + Momentum (one line) */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs capitalize truncate" style={{ color: 'var(--color-text-tertiary)' }}>
          {mover.type}
        </span>
        <span 
          className="text-xs font-bold tabular-nums flex-shrink-0"
          style={{
            color: mover.momentum > 0 
              ? 'var(--color-momentum-up)' 
              : 'var(--color-momentum-down)'
          }}
        >
          {mover.momentum > 0 ? '▲' : '▼'} {Math.abs(mover.momentum).toFixed(0)}%
        </span>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Rising Fast */}
      <div 
        className="p-4 md:p-6 rounded"
        style={{
          backgroundColor: 'var(--color-broadcast-panel)',
          border: '1px solid var(--color-broadcast-border)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)'
        }}
      >
        <h2 className="text-base md:text-lg font-bold mb-3 md:mb-4 flex items-center gap-2">
          <span style={{ color: 'var(--color-momentum-up)' }}>Rising Fast</span>
          <span className="text-xs md:text-sm font-normal" style={{ color: 'var(--color-text-tertiary)' }}>
            Top {Math.min(5, rising.length)}
          </span>
        </h2>

        {rising.length === 0 ? (
          <p className="text-center py-4 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            No rising entities
          </p>
        ) : (
          <div className="space-y-2">
            {rising.slice(0, 5).map(m => renderMover(m, 'rising'))}
          </div>
        )}
      </div>

      {/* Falling Fast */}
      {falling.length > 0 && (
        <div 
          className="p-4 md:p-6 rounded"
          style={{
            backgroundColor: 'var(--color-broadcast-panel)',
            border: '1px solid var(--color-broadcast-border)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)'
          }}
        >
          <h2 className="text-base md:text-lg font-bold mb-3 md:mb-4 flex items-center gap-2">
            <span style={{ color: 'var(--color-momentum-down)' }}>Falling Fast</span>
            <span className="text-xs md:text-sm font-normal" style={{ color: 'var(--color-text-tertiary)' }}>
              Top {Math.min(5, falling.length)}
            </span>
          </h2>

          <div className="space-y-2">
            {falling.slice(0, 5).map(m => renderMover(m, 'falling'))}
          </div>
        </div>
      )}
    </div>
  );
}
