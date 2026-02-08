'use client';

import { WindowType, TIME_RANGES } from '@/lib/types';

interface MastheadProps {
  currentWindow: WindowType;
  onWindowChange: (window: WindowType) => void;
  lastUpdate?: string;
}

export function Masthead({ currentWindow, onWindowChange, lastUpdate }: MastheadProps) {
  return (
    <div 
      className="sticky top-0 z-50"
      style={{
        backgroundColor: 'rgba(10, 11, 13, 0.98)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--color-broadcast-border)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)'
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-8">
          {/* Left: Brand */}
          <div className="flex items-center gap-3 md:gap-6 min-w-0 flex-shrink-0">
            <img 
              src="/dabbleverse-logo.png" 
              alt="Dabbleverse Logo" 
              className="w-10 h-10 md:w-12 md:h-12 flex-shrink-0"
              style={{
                filter: 'drop-shadow(0 0 10px rgba(230, 57, 70, 0.4))'
              }}
            />
            <h1 
              className="text-2xl md:text-3xl font-black tracking-tight whitespace-nowrap"
              style={{
                color: 'var(--color-broadcast-accent)',
                textShadow: '0 0 20px rgba(230, 57, 70, 0.5), 0 2px 4px rgba(0, 0, 0, 0.8)',
                letterSpacing: '-0.02em'
              }}
            >
              DABBLEVERSE
            </h1>
            
            <div 
              className="hidden lg:block w-px h-10 flex-shrink-0" 
              style={{ backgroundColor: 'var(--color-broadcast-border)' }} 
            />
            
            <span 
              className="hidden lg:block text-base font-medium whitespace-nowrap" 
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Unbiased Real-Time Analytics
            </span>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-3 md:gap-6 flex-shrink-0">
            {/* Time Window Selector */}
            <div 
              className="flex items-center gap-0.5 md:gap-1 rounded-lg p-0.5 md:p-1" 
              style={{ backgroundColor: 'var(--color-broadcast-surface)' }}
            >
              {TIME_RANGES.map((range) => {
                const isActive = currentWindow === range.value;
                return (
                  <button
                    key={range.value}
                    onClick={() => onWindowChange(range.value)}
                    className="relative px-3 md:px-5 py-1.5 md:py-2.5 rounded-md text-xs md:text-sm font-bold transition-all duration-200 min-w-[50px] md:min-w-[60px]"
                    style={
                      isActive
                        ? {
                            backgroundColor: 'var(--color-broadcast-accent)',
                            color: 'white',
                            boxShadow: '0 0 20px rgba(230, 57, 70, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3)',
                            transform: 'translateY(-1px)'
                          }
                        : {
                            backgroundColor: 'transparent',
                            color: 'var(--color-text-tertiary)',
                          }
                    }
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.color = 'var(--color-text-primary)';
                        e.currentTarget.style.backgroundColor = 'var(--color-broadcast-panel)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.color = 'var(--color-text-tertiary)';
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    {range.label}
                  </button>
                );
              })}
            </div>

            {/* Status Indicator */}
            {lastUpdate && (
              <div className="hidden lg:flex items-center gap-2.5 px-3 py-2 rounded-md" style={{ backgroundColor: 'var(--color-broadcast-surface)' }}>
                <div 
                  className="w-2 h-2 rounded-full animate-pulse flex-shrink-0" 
                  style={{ 
                    backgroundColor: 'var(--color-momentum-up)',
                    boxShadow: '0 0 8px var(--color-momentum-up)'
                  }}
                />
                <span className="text-xs font-medium whitespace-nowrap" style={{ color: 'var(--color-text-tertiary)' }}>
                  LIVE • {new Date(lastUpdate).toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Mobile subtitle */}
        <div className="lg:hidden mt-2">
          <span 
            className="text-xs md:text-sm font-medium" 
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Unbiased Real-Time Analytics
          </span>
        </div>
      </div>
    </div>
  );
}
