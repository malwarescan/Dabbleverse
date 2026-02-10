'use client';

import { useState, useEffect } from 'react';

type LiveItem = {
  videoId: string;
  url: string;
  title: string;
  displayName: string;
  startedAt: string;
};

type ChannelGross = {
  displayName: string;
  grossUsd: number;
};

export function LiveBanner() {
  const [live, setLive] = useState<LiveItem[]>([]);
  const [channelGross, setChannelGross] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLive = async () => {
      try {
        const res = await fetch('/api/live/leaderboard');
        const data = await res.json();
        const liveNow: LiveItem[] = data.liveNow ?? [];
        const channels: ChannelGross[] = data.channels ?? [];
        const grossMap: Record<string, number> = {};
        for (const c of channels) grossMap[c.displayName] = c.grossUsd;
        setLive(liveNow);
        setChannelGross(grossMap);
      } catch (_) {
        setLive([]);
      } finally {
        setLoading(false);
      }
    };
    fetchLive();
    const interval = setInterval(fetchLive, 20000);
    return () => clearInterval(interval);
  }, []);

  if (loading || live.length === 0) return null;

  return (
    <div
      className="w-full z-[60] sticky top-0 border-b flex items-center gap-6 px-4 py-2 overflow-x-auto shrink-0"
      style={{
        backgroundColor: 'var(--color-broadcast-surface)',
        borderColor: 'var(--color-broadcast-border)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <span className="flex items-center gap-1.5 shrink-0 font-bold text-sm uppercase tracking-wide" style={{ color: 'var(--color-broadcast-accent)' }}>
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        Live
      </span>
      <div className="flex items-center gap-4 flex-wrap">
        {live.map((item) => {
          const gross = channelGross[item.displayName] ?? 0;
          return (
            <a
              key={item.videoId}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 shrink-0 px-3 py-1.5 rounded transition-colors hover:opacity-90"
              style={{
                backgroundColor: 'var(--color-broadcast-panel)',
                border: '1px solid var(--color-broadcast-border)',
              }}
            >
              <span className="font-semibold text-sm truncate max-w-[140px] md:max-w-[200px]" style={{ color: 'var(--color-text-primary)' }}>
                {item.displayName}
              </span>
              <span className="text-sm font-bold tabular-nums shrink-0" style={{ color: 'var(--color-momentum-up)' }}>
                ${gross.toFixed(2)}
              </span>
              <span className="text-xs shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
                today
              </span>
            </a>
          );
        })}
      </div>
      <a
        href="/playboard"
        className="shrink-0 text-xs font-semibold ml-auto hover:underline"
        style={{ color: 'var(--color-broadcast-accent)' }}
      >
        Playboard →
      </a>
    </div>
  );
}
