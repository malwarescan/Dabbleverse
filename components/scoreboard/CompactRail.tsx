import { ScoreboardRow } from '@/lib/types';
import { RankBadge } from '@/components/ui/Badge';

interface CompactRailProps {
  title: string;
  rows: ScoreboardRow[];
  /** Max rows to show (default 5) */
  limit?: number;
}

const panelStyle = {
  backgroundColor: 'var(--color-broadcast-panel)',
  border: '1px solid var(--color-broadcast-border)',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
};

export function CompactRail({ title, rows, limit = 5 }: CompactRailProps) {
  const list = rows.slice(0, limit);
  if (list.length === 0) {
    return (
      <div className="p-4 rounded min-w-0 w-full" style={panelStyle}>
        <h2 className="text-base font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>
          {title}
        </h2>
        <p className="text-xs text-center py-4" style={{ color: 'var(--color-text-tertiary)' }}>
          No data
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 rounded min-w-0 w-full" style={panelStyle}>
      <h2 className="text-base font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
        {title}
        <span className="text-xs font-normal" style={{ color: 'var(--color-text-tertiary)' }}>
          Top {list.length}
        </span>
      </h2>
      <div className="space-y-2">
        {list.map((row) => (
          <div
            key={row.entityId}
            className="flex items-center gap-2 py-1.5 rounded px-1"
            style={{ border: '1px solid transparent' }}
          >
            <RankBadge rank={row.rank} deltaRank={row.deltaRank} />
            <span
              className="text-sm font-medium truncate flex-1 min-w-0"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {row.name}
            </span>
            <span className="text-xs tabular-nums shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
              {row.score.toFixed(0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
