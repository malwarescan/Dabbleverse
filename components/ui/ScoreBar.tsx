interface ScoreBarProps {
  score: number; // 0-100
  className?: string;
}

export function ScoreBar({ score, className }: ScoreBarProps) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
          {score.toFixed(1)}
        </span>
      </div>
      <div 
        className="h-2 rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--color-broadcast-border)' }}
      >
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{ 
            width: `${score}%`,
            background: 'linear-gradient(90deg, var(--color-broadcast-accent), var(--color-broadcast-accent-hover))'
          }}
        />
      </div>
    </div>
  );
}
