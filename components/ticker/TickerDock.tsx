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
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{
        backgroundColor: 'var(--color-broadcast-surface)',
        borderTop: '1px solid var(--color-broadcast-border)',
        boxShadow: '0 -2px 16px rgba(0, 0, 0, 0.5)',
        height: '240px' // Increased for mobile
      }}
    >
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="px-4 md:px-6 py-2 md:py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-broadcast-border)' }}>
          <h3 className="text-sm md:text-base font-bold flex items-center gap-2">
            <span 
              className="w-2 h-2 rounded-full animate-pulse flex-shrink-0" 
              style={{ backgroundColor: 'var(--color-broadcast-accent)' }}
            />
            <span className="hidden sm:inline">Live Feed</span>
            <span className="sm:hidden">Feed</span>
          </h3>
          <span className="text-xs md:text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            {cards.length}
          </span>
        </div>

        {/* Ticker Cards */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full px-3 md:px-6 py-3 md:py-4 flex gap-3 md:gap-4 overflow-x-auto">
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
      className="flex-shrink-0 w-72 md:w-80 h-full p-3 md:p-4 rounded transition-shadow duration-200"
      style={{
        backgroundColor: 'var(--color-broadcast-panel)',
        border: '1px solid var(--color-broadcast-border)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)'
      }}
      onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.5)'}
      onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.4)'}
    >
      <div className="flex flex-col h-full gap-2 md:gap-3">
        {/* Source Badge */}
        <div>
          <SourceBadge platform={card.source} />
        </div>

        {/* Title */}
        <h4 className="text-sm md:text-base font-semibold truncate-2 flex-shrink-0" style={{ color: 'var(--color-text-primary)' }}>
          {card.title}
        </h4>

        {/* Meta */}
        <div className="text-xs md:text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
          {card.meta.channel || card.meta.author} •{' '}
          {formatDistanceToNow(new Date(card.meta.timestamp), { addSuffix: true })}
        </div>

        {/* Why it matters */}
        <div className="mt-auto">
          <div className="text-xs md:text-sm font-medium mb-1" style={{ color: 'var(--color-broadcast-accent)' }}>
            Why it matters:
          </div>
          <p className="text-xs md:text-sm truncate-2" style={{ color: 'var(--color-text-secondary)' }}>
            {card.why}
          </p>
        </div>
      </div>
    </a>
  );
}
