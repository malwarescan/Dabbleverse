'use client';

import { useState, useEffect } from 'react';
import { LiveBanner } from '@/components/live/LiveBanner';

const MICROS_PER_DOLLAR = 1_000_000;
const TYPE_LABELS: Record<string, string> = {
  super_chat: 'Super Chat',
  super_sticker: 'Super Sticker',
  membership_gift: 'Gifted Memberships',
  member_milestone: 'Member',
};

type Breakdown = Record<string, { micros: number; count: number }>;

type Leaderboard = {
  date: string;
  demo?: boolean;
  channels: {
    sourceAccountId: string;
    displayName: string;
    grossUsd: number;
    eventCount: number;
    breakdown: Breakdown;
  }[];
  streams: {
    videoId: string;
    url: string;
    displayName: string;
    grossUsd: number;
    eventCount: number;
    breakdown: Breakdown;
  }[];
  liveNow: { videoId: string; url: string; title: string; displayName: string; startedAt: string }[];
};

type RecentEvent = {
  videoId: string;
  url: string;
  channelName: string;
  type: string;
  amountUsd: number;
  giftCount?: number;
  tier?: string;
  publishedAt: string;
};

function formatBreakdown(breakdown: Breakdown): { label: string; usd: number; count: number }[] {
  return Object.entries(breakdown).map(([type, data]) => ({
    label: TYPE_LABELS[type] ?? type.replace(/_/g, ' '),
    usd: data.micros / MICROS_PER_DOLLAR,
    count: data.count,
  }));
}

export default function PlayboardPage() {
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [recent, setRecent] = useState<RecentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingLive, setRefreshingLive] = useState(false);

  const fetchData = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const lbRes = await fetch('/api/live/leaderboard', { signal: controller.signal });
      const lb = lbRes.ok ? await lbRes.json() : { date: '', demo: true, channels: [], streams: [], liveNow: [] };
      setLeaderboard({
        date: lb.date ?? '',
        demo: lb.demo ?? false,
        channels: lb.channels ?? [],
        streams: lb.streams ?? [],
        liveNow: lb.liveNow ?? [],
      });
      try {
        const recentRes = await fetch('/api/live/recent', { signal: controller.signal });
        const rec = recentRes.ok ? await recentRes.json() : {};
        if (rec.events) setRecent(rec.events);
      } catch (_) {
        // recent is optional
      }
    } catch (e) {
      console.error(e);
      const today = new Date().toISOString().slice(0, 10);
      setLeaderboard({
        date: today,
        demo: true,
        channels: [],
        streams: [],
        liveNow: [],
      });
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const refreshLive = async () => {
    setRefreshingLive(true);
    try {
      await fetch('/api/cron/live');
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshingLive(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-8" style={{ backgroundColor: 'var(--color-broadcast-bg)' }}>
        <p style={{ color: 'var(--color-text-tertiary)' }}>Loading Playboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-broadcast-bg)' }}>
      <LiveBanner />
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Daily profit — today&apos;s gross
          </h1>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={refreshLive}
              disabled={refreshingLive}
              className="text-sm font-semibold px-3 py-1.5 rounded transition-colors disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-broadcast-accent)', color: 'white' }}
            >
              {refreshingLive ? 'Refreshing…' : 'Refresh live'}
            </button>
            <a href="/" className="text-sm font-semibold hover:underline" style={{ color: 'var(--color-broadcast-accent)' }}>
              ← Leaders
            </a>
          </div>
        </div>
        <p className="text-sm mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
          <strong style={{ color: 'var(--color-text-secondary)' }}>Date: {leaderboard?.date ?? new Date().toISOString().slice(0, 10)}</strong>
          {leaderboard?.demo ? (
            <span className="ml-2 px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-600 dark:text-amber-400">
              No real data yet — worker ingests Super Chats when channels go live
            </span>
          ) : (
            <>
              <span className="ml-2 text-xs font-medium" style={{ color: 'var(--color-broadcast-accent)' }}>Live</span>
              {leaderboard?.channels?.length !== undefined && (
                <span className="ml-2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  — {leaderboard.channels.length} channel{leaderboard.channels.length !== 1 ? 's' : ''} with revenue today (from live streams only; demo seed hidden)
                </span>
              )}
            </>
          )}
        </p>

        {/* Live now */}
        {leaderboard?.liveNow && leaderboard.liveNow.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Live now
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {leaderboard.liveNow.map((live) => (
                <a
                  key={live.videoId}
                  href={live.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 rounded border transition-colors"
                  style={{
                    backgroundColor: 'var(--color-broadcast-panel)',
                    borderColor: 'var(--color-broadcast-border)',
                  }}
                >
                  <div className="font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {live.displayName}
                  </div>
                  <div className="text-sm truncate mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                    {live.title || 'Live stream'}
                  </div>
                  <div className="text-xs mt-2" style={{ color: 'var(--color-text-tertiary)' }}>
                    Watch live →
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top channels today — with breakdown */}
          <section
            className="p-4 md:p-6 rounded"
            style={{
              backgroundColor: 'var(--color-broadcast-panel)',
              border: '1px solid var(--color-broadcast-border)',
            }}
          >
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              Today&apos;s profit by channel (gross)
            </h2>
            {leaderboard?.channels?.length ? (
              <ul className="space-y-4">
                {leaderboard.channels.map((c, i) => {
                  const breakdownList = formatBreakdown(c.breakdown);
                  return (
                    <li
                      key={c.sourceAccountId}
                      className="pb-4 border-b last:border-b-0"
                      style={{ borderColor: 'var(--color-broadcast-border-subtle)' }}
                    >
                      <div className="flex justify-between items-start">
                        <span style={{ color: 'var(--color-text-secondary)' }}>
                          {i + 1}. {c.displayName}
                        </span>
                        <span className="font-semibold shrink-0" style={{ color: 'var(--color-momentum-up)' }}>
                          ${c.grossUsd.toFixed(2)} <span className="text-xs font-normal">({c.eventCount})</span>
                        </span>
                      </div>
                      {breakdownList.length > 0 && (
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                          {breakdownList.map((b) => (
                            <span key={b.label}>
                              {b.label}: ${b.usd.toFixed(2)} ({b.count})
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-sm space-y-2" style={{ color: 'var(--color-text-tertiary)' }}>
                <p>No daily profit yet today.</p>
                {leaderboard?.demo && (
                  <p className="text-xs mt-2 p-3 rounded bg-amber-500/10 border border-amber-500/30">
                    <strong>Setup:</strong> Add Redis on Railway, use start command <code className="text-xs">npm run start:with-worker</code>, set REDIS_URL + DATABASE_URL + YOUTUBE_API_KEY, run <code className="text-xs">pnpm run resolve:channels</code> against the production DB, then hit <a href="/api/cron/live" target="_blank" rel="noopener noreferrer" className="underline">/api/cron/live</a> to trigger the worker. See <a href="https://github.com/malwarescan/Dabbleverse/blob/main/RAILWAY_PLAYBOARD_STEPS.md" target="_blank" rel="noopener noreferrer" className="underline">RAILWAY_PLAYBOARD_STEPS.md</a>.
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Top streams — with breakdown */}
          <section
            className="p-4 md:p-6 rounded"
            style={{
              backgroundColor: 'var(--color-broadcast-panel)',
              border: '1px solid var(--color-broadcast-border)',
            }}
          >
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              Stream profit breakdown (gross)
            </h2>
            {leaderboard?.streams?.length ? (
              <ul className="space-y-4">
                {leaderboard.streams.map((s, i) => {
                  const breakdownList = formatBreakdown(s.breakdown);
                  return (
                    <li
                      key={s.videoId}
                      className="pb-4 border-b last:border-b-0"
                      style={{ borderColor: 'var(--color-broadcast-border-subtle)' }}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate flex-1 text-sm hover:underline"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          {i + 1}. {s.displayName}
                        </a>
                        <span className="font-semibold shrink-0" style={{ color: 'var(--color-momentum-up)' }}>
                          ${s.grossUsd.toFixed(2)} ({s.eventCount})
                        </span>
                      </div>
                      {breakdownList.length > 0 && (
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                          {breakdownList.map((b) => (
                            <span key={b.label}>
                              {b.label}: ${b.usd.toFixed(2)} ({b.count})
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                No stream data yet.
              </p>
            )}
          </section>
        </div>

        {/* Every single item — recent monetization feed */}
        <section className="mt-8">
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            Every item (recent events)
          </h2>
          <div
            className="p-4 md:p-6 rounded max-h-[480px] overflow-y-auto"
            style={{
              backgroundColor: 'var(--color-broadcast-panel)',
              border: '1px solid var(--color-broadcast-border)',
            }}
          >
            {recent.length ? (
              <ul className="space-y-2">
                {recent.slice(0, 50).map((e, i) => (
                  <li
                    key={`${e.videoId}-${e.publishedAt}-${i}`}
                    className="flex justify-between items-center text-sm py-1.5 border-b last:border-b-0"
                    style={{ borderColor: 'var(--color-broadcast-border-subtle)' }}
                  >
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      <span className="font-medium">{e.channelName}</span>
                      {' · '}
                      <span className="capitalize">{TYPE_LABELS[e.type] ?? e.type.replace(/_/g, ' ')}</span>
                      {e.giftCount != null && e.giftCount > 0 && ` (×${e.giftCount})`}
                      {e.tier && ` · ${e.tier}`}
                    </span>
                    <span className="font-semibold shrink-0 ml-2" style={{ color: 'var(--color-momentum-up)' }}>
                      ${e.amountUsd.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                No recent events. Live streams with Super Chats, memberships, or gifted members will appear here.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
