import { ScoreboardRow, EntityType } from '@/lib/types';
import { clsx } from 'clsx';

interface CategoryCardsProps {
  characters: ScoreboardRow[];
  storylines: ScoreboardRow[];
  shows: ScoreboardRow[];
  chatters: ScoreboardRow[];
  clippers: ScoreboardRow[];
}

export function CategoryCards({ characters, storylines, shows, chatters, clippers }: CategoryCardsProps) {
  return (
    <div className="space-y-6">
      {/* Top Row: Characters, Storylines, Shows */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <CategoryCard title="Characters" rows={characters} type="character" />
        <CategoryCard title="Storylines" rows={storylines} type="storyline" />
        <CategoryCard title="Shows" rows={shows} type="show" />
      </div>

      {/* Bottom Row: Chatters, Clippers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <CategoryCard title="Top Commenters" rows={chatters} type="chatter" />
        <CategoryCard title="Top Clippers" rows={clippers} type="clipper" />
      </div>
    </div>
  );
}

interface CategoryCardProps {
  title: string;
  rows: ScoreboardRow[];
  type: EntityType;
  icon?: string;
}

function CategoryCard({ title, rows, type, icon }: CategoryCardProps) {
  const topTen = rows.slice(0, 10);

  return (
    <div 
      className="p-4 md:p-6 rounded"
      style={{
        backgroundColor: 'var(--color-broadcast-panel)',
        border: '1px solid var(--color-broadcast-border)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)'
      }}
    >
      <h3 className="text-base md:text-lg font-bold mb-3 md:mb-4 flex items-center gap-2">
        {icon && <span className="text-xl">{icon}</span>}
        <span>{title}</span>
        <span className="text-xs md:text-sm font-normal" style={{ color: 'var(--color-text-tertiary)' }}>
          Top 10
        </span>
      </h3>

      {topTen.length === 0 ? (
        <p className="text-center py-8" style={{ color: 'var(--color-text-tertiary)' }}>
          No data available
        </p>
      ) : (
        <div className="space-y-2">
          {topTen.map((row) => (
            <div
              key={row.entityId}
              className="flex items-center justify-between p-3 rounded transition-colors cursor-pointer"
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-broadcast-panel-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {/* Rank + Name */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className="flex items-center justify-center w-6 h-6 rounded text-sm font-bold tabular-nums flex-shrink-0"
                  style={{ color: row.rank <= 3 ? 'var(--color-broadcast-accent)' : 'var(--color-text-tertiary)' }}
                >
                  {row.rank}
                </div>
                <div className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                  {row.name}
                </div>
              </div>

              {/* Score + Momentum */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-sm font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                  {row.score.toFixed(0)}
                </div>
                <div
                  className="text-xs font-medium tabular-nums"
                  style={{
                    color: row.momentum > 0 
                      ? 'var(--color-momentum-up)' 
                      : row.momentum < 0 
                        ? 'var(--color-momentum-down)' 
                        : 'var(--color-momentum-neutral)'
                  }}
                >
                  {row.momentum > 0 ? '+' : ''}
                  {row.momentum.toFixed(0)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
