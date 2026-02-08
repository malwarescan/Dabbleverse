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
      <div className="max-w-7xl mx-auto px-4 py-3">
        {/* SINGLE responsive layout - works on ALL screen sizes */}
        <div className="grid grid-cols-[auto_1fr_auto] gap-2 items-center">
          {/* Left: Logo */}
          <div className="flex justify-start">
            <img 
              src="/dabbleverse-logo.png" 
              alt="Dabbleverse" 
              className="h-10 sm:h-12 md:h-16 lg:h-20 w-auto object-contain"
              style={{
                filter: 'drop-shadow(0 0 20px rgba(230, 57, 70, 0.5))'
              }}
            />
          </div>

          {/* Center: Tagline */}
          <div className="flex justify-center px-2">
            <span 
              className="text-xs sm:text-sm md:text-base lg:text-lg font-bold text-center" 
              style={{ 
                color: 'var(--color-text-secondary)',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
              }}
            >
              Unbiased Real-Time Analytics
            </span>
          </div>

          {/* Right: Controls */}
          <div className="flex justify-end items-center">
            {/* Time Window Selector */}
            <div 
              className="flex items-center gap-0.5 sm:gap-1 rounded-lg p-0.5 sm:p-1" 
              style={{ backgroundColor: 'var(--color-broadcast-surface)' }}
            >
              {TIME_RANGES.map((range) => {
                const isActive = currentWindow === range.value;
                return (
                  <button
                    key={range.value}
                    onClick={() => onWindowChange(range.value)}
                    className="relative px-2 sm:px-3 md:px-4 lg:px-5 py-1.5 sm:py-2 md:py-2.5 rounded-md text-xs sm:text-sm font-bold transition-all duration-200"
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

          </div>
        </div>
      </div>
    </div>
  );
}
