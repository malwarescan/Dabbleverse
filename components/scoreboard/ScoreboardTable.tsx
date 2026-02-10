import { ScoreboardRow } from '@/lib/types';
import { RankBadge, MomentumBadge } from '@/components/ui/Badge';
import { ScoreBar } from '@/components/ui/ScoreBar';
import { SourcePills } from '@/components/ui/SourcePills';

interface ScoreboardTableProps {
  rows: ScoreboardRow[];
  onRowClick?: (row: ScoreboardRow) => void;
}

export function ScoreboardTable({ rows, onRowClick }: ScoreboardTableProps) {
  if (rows.length === 0) {
    return (
      <div 
        className="p-8 text-center rounded"
        style={{
          backgroundColor: 'var(--color-broadcast-panel)',
          border: '1px solid var(--color-broadcast-border)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)'
        }}
      >
        <p style={{ color: 'var(--color-text-tertiary)' }}>No data available</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: Card Layout */}
      <div className="md:hidden space-y-3">
        {rows.map((row) => (
          <button
            key={`scoreboard-${row.entityId}`}
            onClick={() => onRowClick?.(row)}
            className="w-full text-left p-4 rounded transition-all duration-200"
            style={{
              backgroundColor: 'var(--color-broadcast-panel)',
              border: '1px solid var(--color-broadcast-border)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-broadcast-panel-hover)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-broadcast-panel)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.4)';
            }}
          >
            {/* Top Row: Rank + Name */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <RankBadge rank={row.rank} deltaRank={row.deltaRank} />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-base truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {row.name}
                  </div>
                  <div className="text-xs capitalize mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                    {row.type}
                  </div>
                </div>
              </div>
              <MomentumBadge momentum={row.momentum} microMomentum={row.microMomentum} />
            </div>

            {/* Score Bar */}
            <div className="mb-3">
              <ScoreBar score={row.score} />
            </div>

            {/* Bottom Row: Sources + Today's profit */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <SourcePills sources={row.sources} />
              <span className="text-sm font-semibold tabular-nums" style={{ color: row.profitToday != null && row.profitToday > 0 ? 'var(--color-momentum-up)' : 'var(--color-text-tertiary)' }}>
                {row.profitToday != null ? `$${Number(row.profitToday).toFixed(2)}` : '—'}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Desktop: Table Layout */}
      <div 
        className="hidden md:block overflow-hidden rounded"
        style={{
          backgroundColor: 'var(--color-broadcast-panel)',
          border: '1px solid var(--color-broadcast-border)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)'
        }}
      >
        {/* Header */}
        <div 
          className="px-4 py-3"
          style={{
            backgroundColor: 'var(--color-broadcast-surface)',
            borderBottom: '1px solid var(--color-broadcast-border)'
          }}
        >
          <div className="grid gap-4 items-center text-sm font-medium uppercase tracking-wide" style={{ 
            gridTemplateColumns: '4rem 1fr 5rem 6rem 8rem 6rem',
            color: 'var(--color-text-secondary)'
          }}>
            <div>Rank</div>
            <div>Entity</div>
            <div>Score</div>
            <div>Momentum</div>
            <div>Sources</div>
            <div>Profit</div>
          </div>
        </div>

        {/* Rows */}
        <div>
          {rows.map((row, index) => (
            <button
              key={`scoreboard-desktop-${row.entityId}`}
              onClick={() => onRowClick?.(row)}
              className="w-full text-left transition-colors duration-100 border-b last:border-0"
              style={{
                borderColor: 'var(--color-broadcast-border-subtle)',
                backgroundColor: index % 2 === 1 ? 'rgba(18, 20, 26, 0.4)' : 'transparent',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-broadcast-panel-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 1 ? 'rgba(18, 20, 26, 0.4)' : 'transparent'}
            >
              <div className="grid gap-4 items-center px-4 py-3" style={{ 
                gridTemplateColumns: '4rem 1fr 5rem 6rem 8rem 6rem'
              }}>
                {/* Rank + Delta */}
                <div>
                  <RankBadge rank={row.rank} deltaRank={row.deltaRank} />
                </div>

                {/* Entity Name + Type */}
                <div className="flex flex-col gap-1">
                  <div className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {row.name}
                  </div>
                  <div className="text-sm capitalize" style={{ color: 'var(--color-text-tertiary)' }}>
                    {row.type}
                  </div>
                </div>

                {/* Score */}
                <div>
                  <ScoreBar score={row.score} />
                </div>

                {/* Momentum */}
                <div>
                  <MomentumBadge
                    momentum={row.momentum}
                    microMomentum={row.microMomentum}
                  />
                </div>

                {/* Sources */}
                <div>
                  <SourcePills sources={row.sources} />
                </div>

                {/* Profit (today's Super Chat gross) */}
                <div className="font-semibold tabular-nums" style={{ color: row.profitToday != null && row.profitToday > 0 ? 'var(--color-momentum-up)' : 'var(--color-text-tertiary)' }}>
                  {row.profitToday != null ? `$${Number(row.profitToday).toFixed(2)}` : '—'}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
