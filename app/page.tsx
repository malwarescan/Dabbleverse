'use client';

import { useState, useEffect } from 'react';
import { Masthead } from '@/components/scoreboard/Masthead';
import { ScoreboardTable } from '@/components/scoreboard/ScoreboardTable';
import { MoversRail } from '@/components/scoreboard/MoversRail';
import { CategoryCards } from '@/components/scoreboard/CategoryCards';
import { TickerDock } from '@/components/ticker/TickerDock';
import {
  WindowType,
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

  // Filter by entity type for category cards
  const characters = scoreboardData?.rows.filter((r) => r.type === 'character') || [];
  const storylines = scoreboardData?.rows.filter((r) => r.type === 'storyline') || [];
  const shows = scoreboardData?.rows.filter((r) => r.type === 'show') || [];
  const chatters = scoreboardData?.rows.filter((r) => r.type === 'chatter') || [];
  const clippers = scoreboardData?.rows.filter((r) => r.type === 'clipper') || [];

  return (
    <div className="min-h-screen pb-[240px] md:pb-[210px]" style={{ backgroundColor: 'var(--color-broadcast-bg)' }}>
      {/* Masthead */}
      <Masthead
        currentWindow={currentWindow}
        onWindowChange={setCurrentWindow}
        lastUpdate={scoreboardData?.computedAt}
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-8">
        {loading && !scoreboardData ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-sm md:text-base" style={{ color: 'var(--color-text-tertiary)' }}>
              Loading scoreboard...
            </div>
          </div>
        ) : (
          <>
            {/* Two-column layout: Scoreboard + Rail */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 md:gap-6 mb-6 md:mb-8">
              {/* Left: Primary Scoreboard */}
              <div>
                <h2 className="text-xl md:text-2xl font-bold mb-3 md:mb-4">
                  Top Characters
                </h2>
                <ScoreboardTable
                  rows={characters.slice(0, 10) || []}
                  onRowClick={(row) => {
                    console.log('Row clicked:', row);
                    // TODO: Navigate to entity page in Phase 2
                  }}
                />
              </div>

              {/* Right: What Moved Rail */}
              <div>
                <MoversRail movers={moversData?.movers || []} />
              </div>
            </div>

            {/* Category Cards */}
            <CategoryCards
              characters={characters}
              storylines={storylines}
              shows={shows}
              chatters={chatters}
              clippers={clippers}
            />
          </>
        )}
      </div>

      {/* Bottom Ticker Dock */}
      <TickerDock cards={feedData?.cards || []} />
    </div>
  );
}
