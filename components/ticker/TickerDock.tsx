'use client';

import { FeedCardData, PLATFORM_LABELS } from '@/lib/types';
import { SourceBadge } from '@/components/ui/Badge';
import { formatDistanceToNow } from 'date-fns';

interface TickerDockProps {
  cards: FeedCardData[];
}

export function TickerDock({ cards }: TickerDockProps) {
  if (cards.length === 0) {
    return null;
  }

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-40 h-[240px] md:h-[210px]"
      style={{
        backgroundColor: 'var(--color-broadcast-surface)',
        borderTop: '1px solid var(--color-broadcast-border)',
        boxShadow: '0 -2px 16px rgba(0, 0, 0, 0.5)'
      }}
    >
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="px-3 md:px-6 py-1.5 md:py-2 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-broadcast-border)' }}>
          <h3 className="text-xs md:text-sm font-bold flex items-center gap-1.5">
            <span 
              className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" 
              style={{ backgroundColor: 'var(--color-broadcast-accent)' }}
            />
            <span className="hidden sm:inline">Live Feed</span>
            <span className="sm:hidden">Feed</span>
          </h3>
          <span className="text-[10px] md:text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            {cards.length}
          </span>
        </div>

        {/* Ticker Cards */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <div className="h-full min-h-0 px-2 md:px-6 py-1.5 md:py-2 flex gap-2 md:gap-3 overflow-x-auto">
            {cards.map((card) => (
              <TickerCard key={card.id} card={card} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface TickerCardProps {
  card: FeedCardData;
}

function TickerCard({ card }: TickerCardProps) {
  return (
    <a
      href={card.url}
      target="_blank"
      rel="noopener noreferrer"
      className="shrink-0 w-64 md:w-72 h-full min-h-0 p-1.5 md:p-2 rounded transition-shadow duration-200 overflow-hidden"
      style={{
        backgroundColor: 'var(--color-broadcast-panel)',
        border: '1px solid var(--color-broadcast-border)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)'
      }}
      onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.5)'}
      onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.4)'}
    >
      <div className="flex flex-col h-full min-h-0 gap-1 md:gap-1.5">
        {/* Source Badge */}
        <div className="shrink-0">
          <SourceBadge platform={card.source} className="text-[10px] px-1.5 py-0.5" />
        </div>

        {/* Title */}
        <h4 className="text-xs md:text-sm font-semibold line-clamp-2 shrink-0 leading-tight" style={{ color: 'var(--color-text-primary)' }}>
          {card.title}
        </h4>

        {/* Meta */}
        <div className="text-[10px] md:text-xs shrink-0 truncate" style={{ color: 'var(--color-text-tertiary)' }}>
          {card.meta.channel || card.meta.author} •{' '}
          {formatDistanceToNow(new Date(card.meta.timestamp), { addSuffix: true })}
        </div>

        {/* Why it matters - constrained to fit */}
        <div className="mt-auto min-h-0 flex flex-col shrink">
          <div className="text-[10px] md:text-xs font-medium mb-0.5 shrink-0" style={{ color: 'var(--color-broadcast-accent)' }}>
            Why it matters:
          </div>
          <p className="text-[10px] md:text-xs line-clamp-2 min-h-0 leading-tight" style={{ color: 'var(--color-text-secondary)' }}>
            {card.why}
          </p>
        </div>
      </div>
    </a>
  );
}
