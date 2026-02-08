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
        {/* 3-column layout for medium screens and up */}
        <div className="hidden md:grid md:grid-cols-3 gap-4 items-center">
          {/* Left: Logo */}
          <div className="flex justify-start">
            <img 
              src="/dabbleverse-logo.png" 
              alt="Dabbleverse" 
              className="h-16 md:h-20 w-auto object-contain"
              style={{
                filter: 'drop-shadow(0 0 20px rgba(230, 57, 70, 0.5))'
              }}
            />
          </div>

          {/* Center: Tagline */}
          <div className="flex justify-center">
            <span 
              className="text-base md:text-lg font-bold whitespace-nowrap" 
              style={{ 
                color: 'var(--color-text-secondary)',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
              }}
            >
              Unbiased Real-Time Analytics
            </span>
          </div>

          {/* Right: Controls */}
          <div className="flex justify-end items-center gap-2 md:gap-4">
            {/* Time Window Selector */}
            <div 
              className="flex items-center gap-1 rounded-lg p-1" 
              style={{ backgroundColor: 'var(--color-broadcast-surface)' }}
            >
              {TIME_RANGES.map((range) => {
                const isActive = currentWindow === range.value;
                return (
                  <button
                    key={range.value}
                    onClick={() => onWindowChange(range.value)}
                    className="relative px-5 py-2.5 rounded-md text-sm font-bold transition-all duration-200 min-w-[60px]"
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
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-md" style={{ backgroundColor: 'var(--color-broadcast-surface)' }}>
                <div 
                  className="w-2 h-2 rounded-full animate-pulse" 
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

        {/* Mobile only: Stacked layout */}
        <div className="md:hidden">
          {/* Logo centered */}
          <div className="flex justify-center mb-3">
            <img 
              src="/dabbleverse-logo.png" 
              alt="Dabbleverse" 
              className="h-12 sm:h-14 w-auto object-contain"
              style={{
                filter: 'drop-shadow(0 0 20px rgba(230, 57, 70, 0.5))'
              }}
            />
          </div>
          
          {/* Controls centered */}
          <div className="flex justify-center items-center gap-3">
            <div 
              className="flex items-center gap-0.5 rounded-lg p-0.5" 
              style={{ backgroundColor: 'var(--color-broadcast-surface)' }}
            >
              {TIME_RANGES.map((range) => {
                const isActive = currentWindow === range.value;
                return (
                  <button
                    key={range.value}
                    onClick={() => onWindowChange(range.value)}
                    className="relative px-3 py-2 rounded-md text-xs font-bold transition-all duration-200 min-w-[50px]"
                    style={
                      isActive
                        ? {
                            backgroundColor: 'var(--color-broadcast-accent)',
                            color: 'white',
                            boxShadow: '0 0 20px rgba(230, 57, 70, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3)',
                          }
                        : {
                            backgroundColor: 'transparent',
                            color: 'var(--color-text-tertiary)',
                          }
                    }
                  >
                    {range.label}
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Tagline centered */}
          <div className="text-center mt-2">
            <span 
              className="text-xs font-medium" 
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Unbiased Real-Time Analytics
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
