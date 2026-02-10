'use client';

import { useState, useEffect } from 'react';

type Leaderboard = {
  date: string;
  demo?: boolean;
  channels: { displayName: string; grossUsd: number; eventCount: number }[];
  streams?: { displayName: string; grossUsd: number; eventCount: number }[];
  liveNow: { displayName: string; url: string }[];
};

export function PlayboardSummary() {
  const [data, setData] = useState<Leaderboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/live/leaderboard');
        const json = await res.json();
        setData({
          date: json.date ?? '',
          demo: json.demo ?? false,
          channels: json.channels ?? [],
          streams: json.streams ?? [],
          liveNow: json.liveNow ?? [],
        });
      } catch (_) {
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div
        className="p-4 rounded animate-pulse"
        style={{
          backgroundColor: 'var(--color-broadcast-panel)',
          border: '1px solid var(--color-broadcast-border)',
        }}
      >
        <div className="h-5 w-24 rounded mb-3" style={{ backgroundColor: 'var(--color-broadcast-border)' }} />
        <div className="h-3 w-full rounded" style={{ backgroundColor: 'var(--color-broadcast-border)' }} />
      </div>
    );
  }

  const channels = data?.channels ?? [];
  const streams = data?.streams ?? [];
  const topChannels = channels.slice(0, 5);
  const topStreams = streams.slice(0, 5);
  const liveCount = (data?.liveNow ?? []).length;
  const listShown = topChannels.length > 0 ? topChannels : topStreams;
  const totalShown = listShown.reduce((sum, c) => sum + c.grossUsd, 0);
  const hasAny = listShown.length > 0;

  return (
    <div
      className="p-4 rounded"
      style={{
        backgroundColor: 'var(--color-broadcast-panel)',
        border: '1px solid var(--color-broadcast-border)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Daily profit
        </h2>
        <a
          href="/playboard"
          className="text-xs font-semibold hover:underline"
          style={{ color: 'var(--color-broadcast-accent)' }}
        >
          Full view →
        </a>
      </div>
      <p className="text-xs mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
        {data?.date ? `Today (${data.date})` : ''}
        {data?.demo ? ' — no data yet' : ' — live'}
      </p>

      {liveCount > 0 && (
        <div className="flex items-center gap-1.5 mb-3 pb-2 border-b" style={{ borderColor: 'var(--color-broadcast-border-subtle)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            {liveCount} live now
          </span>
        </div>
      )}

      {hasAny ? (
        <ul className="space-y-1.5">
          {listShown.slice(0, 5).map((c, i) => (
            <li key={`${c.displayName}-${i}`} className="flex justify-between items-center text-sm">
              <span className="truncate flex-1 mr-2" style={{ color: 'var(--color-text-secondary)' }}>
                {i + 1}. {c.displayName}
              </span>
              <span className="font-semibold tabular-nums shrink-0" style={{ color: 'var(--color-momentum-up)' }}>
                ${c.grossUsd.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          No activity today yet
        </p>
      )}

      {hasAny && (
        <div className="mt-3 pt-2 border-t text-xs" style={{ borderColor: 'var(--color-broadcast-border-subtle)', color: 'var(--color-text-tertiary)' }}>
          Top 5 total: <span className="font-semibold" style={{ color: 'var(--color-momentum-up)' }}>${totalShown.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}
