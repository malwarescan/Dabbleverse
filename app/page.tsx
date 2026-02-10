'use client';

import { useState, useEffect } from 'react';
import { LiveBanner } from '@/components/live/LiveBanner';
import { PlayboardSummary } from '@/components/live/PlayboardSummary';
import { Masthead } from '@/components/scoreboard/Masthead';
import { ScoreboardTable } from '@/components/scoreboard/ScoreboardTable';
import { MoversRail } from '@/components/scoreboard/MoversRail';
import { CompactRail } from '@/components/scoreboard/CompactRail';
import { TickerDock } from '@/components/ticker/TickerDock';
import {
  WindowType,
  TIME_RANGES,
  ScoreboardResponse,
  MoversResponse,
  FeedResponse,
} from '@/lib/types';

export default function HomePage() {
  const [currentWindow, setCurrentWindow] = useState<WindowType>('now');
  const [scoreboardData, setScoreboardData] = useState<ScoreboardResponse | null>(null);
  const [moversData, setMoversData] = useState<MoversResponse | null>(null);
  const [feedData, setFeedData] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);

      const [scoreboard, movers, feed] = await Promise.all([
        fetch(`/api/scoreboard?window=${currentWindow}`).then((r) => r.json()),
        fetch(`/api/movers?window=${currentWindow}`).then((r) => r.json()),
        fetch(`/api/feed?window=${currentWindow}`).then((r) => r.json()),
      ]);

      setScoreboardData(scoreboard);
      setMoversData(movers);
      setFeedData(feed);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [currentWindow]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
    }, 60000);

    return () => clearInterval(interval);
  }, [currentWindow]);

  // Filter by entity type for Leaders + rails
  const characters = scoreboardData?.rows.filter((r) => r.type === 'character') || [];
  const storylines = scoreboardData?.rows.filter((r) => r.type === 'storyline') || [];
  const shows = scoreboardData?.rows.filter((r) => r.type === 'show') || [];

  return (
    <div className="min-h-screen pb-[240px] md:pb-[210px] overflow-x-hidden" style={{ backgroundColor: 'var(--color-broadcast-bg)' }}>
      {/* Who's live + profit tracker — full-width top banner */}
      <LiveBanner />
      {/* Masthead */}
      <Masthead
        currentWindow={currentWindow}
        onWindowChange={setCurrentWindow}
        lastUpdate={scoreboardData?.computedAt}
      />

      {/* Main Content — overflow hidden so nothing goes past viewport */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-8 min-w-0 overflow-x-hidden">
        {loading && !scoreboardData ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-sm md:text-base" style={{ color: 'var(--color-text-tertiary)' }}>
              Loading scoreboard...
            </div>
          </div>
        ) : (
          <>
            {/* Two-column layout: Scoreboard + Rails. Right column constrained so it never overflows. */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 md:gap-6 mb-6 md:mb-8 min-w-0">
              {/* Left: Primary Scoreboard */}
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-4 mb-3 md:mb-4">
                  <h2 className="text-xl md:text-2xl font-bold max-w-[196px]">
                    Leaders
                  </h2>
                  <div className="flex items-center gap-3">
                    <a
                      href="/playboard"
                      className="text-sm font-semibold hover:underline"
                      style={{ color: 'var(--color-broadcast-accent)' }}
                    >
                      Playboard
                    </a>
                  {/* Time filter - same row, right-aligned */}
                  <div
                    className="flex items-center gap-0.5 sm:gap-1 rounded-lg p-0.5 sm:p-1 shrink-0"
                    style={{ backgroundColor: 'var(--color-broadcast-surface)' }}
                  >
                    {TIME_RANGES.map(({ value, label }) => {
                      const isActive = currentWindow === value;
                      return (
                        <button
                          key={value}
                          onClick={() => setCurrentWindow(value)}
                          className="relative px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-bold transition-all duration-200"
                          style={
                            isActive
                              ? {
                                  backgroundColor: 'var(--color-broadcast-accent)',
                                  color: 'white',
                                  boxShadow: '0 0 20px rgba(230, 57, 70, 0.4)',
                                }
                              : {
                                  backgroundColor: 'transparent',
                                  color: 'var(--color-text-tertiary)',
                                }
                          }
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  </div>
                </div>
                <ScoreboardTable
                  rows={characters.slice(0, 10) || []}
                  onRowClick={(row) => {
                    console.log('Row clicked:', row);
                    // TODO: Navigate to entity page in Phase 2
                  }}
                />
              </div>

              {/* Right: Playboard summary + MoversRail + Storylines + Shows stacked (no horizontal overflow) */}
              <div className="w-full max-w-[320px] lg:max-w-none min-w-0 flex flex-col gap-4">
                <PlayboardSummary />
                <MoversRail movers={moversData?.movers || []} />
                <CompactRail title="Storylines" rows={storylines} limit={5} />
                <CompactRail title="Shows" rows={shows} limit={5} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom Ticker Dock */}
      <TickerDock cards={feedData?.cards || []} />
    </div>
  );
}
