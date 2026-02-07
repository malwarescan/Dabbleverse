# 🛠️ Concrete Implementation Plan - TIER 1 Features

**Sprint Goal:** Transform static scoreboard into interactive ESPN-style product  
**Timeline:** 7-8 days  
**Team:** Frontend + Backend + Data

---

## 📐 Current vs Target Architecture

### Current State (Pretty List)
```
┌─────────────────────────────────────────┐
│ Masthead (Time Selector)                │
├─────────────────────────────────────────┤
│ Category Cards (3-up grid)              │
├─────────────────────────────────────────┤
│ ┌─────────────────┐  ┌───────────────┐ │
│ │ ScoreboardTable │  │ MoversRail    │ │
│ │ (DEAD ROWS)     │  │               │ │
│ │ Click = nothing │  │               │ │
│ └─────────────────┘  └───────────────┘ │
├─────────────────────────────────────────┤
│ TickerDock (STATIC CARDS)               │
│ No auto-scroll, no dedup               │
└─────────────────────────────────────────┘
```

### Target State (Interactive Portal)
```
┌─────────────────────────────────────────┐
│ Masthead + Search + Filters             │
├─────────────────────────────────────────┤
│ Category Cards (click → filter)         │
├─────────────────────────────────────────┤
│ ┌─────────────────┐  ┌───────────────┐ │
│ │ ScoreboardTable │  │ ChangesRail   │ │
│ │ (LIVE ROWS)     │  │ • Risers      │ │
│ │ Click → Drawer  │  │ • Fallers     │ │
│ │ Hover → Preview │  │ • New         │ │
│ └─────────────────┘  │ • Overheated  │ │
│         ↓            └───────────────┘ │
│ ┌─────────────────────────────────────┐│
│ │ EntityDrawer (Slide-in)             ││
│ │ • Trend Chart                       ││
│ │ • Top 5 Receipts (click → open)    ││
│ │ • Source Breakdown                  ││
│ │ • Driver History                    ││
│ │ • Co-Mentions                       ││
│ └─────────────────────────────────────┘│
├─────────────────────────────────────────┤
│ TickerDock (LIVE FEED)                  │
│ • Auto-advance (7s)                     │
│ • Pause on hover                        │
│ • Breaking lane                         │
│ • Dedup indicator                       │
│ • Click card → EntityDrawer             │
└─────────────────────────────────────────┘
```

---

## 🎯 Feature 1: Entity Hub Drawer

### Component Structure
```
components/entity/
├── EntityDrawer.tsx              ← Main container
│   ├── EntityHeader.tsx          ← Name, rank, score, momentum
│   ├── EntityTabs.tsx            ← Overview | Receipts | Timeline | Network
│   └── EntityDrawerContent.tsx   ← Tab content renderer
│
├── tabs/
│   ├── OverviewTab.tsx           ← Default view
│   │   ├── TrendChart.tsx        ← Score/rank over time
│   │   ├── SourceBreakdown.tsx   ← YT/Reddit split
│   │   └── QuickStats.tsx        ← Driver, momentum, percentile
│   │
│   ├── ReceiptsTab.tsx           ← Top items driving score
│   │   └── ReceiptCard.tsx       ← Thumbnail, title, platform, score
│   │
│   ├── TimelineTab.tsx           ← Driver changes over time
│   │   └── DriverHistoryItem.tsx ← When driver changed
│   │
│   └── NetworkTab.tsx            ← Co-mentioned entities
│       └── CoMentionCard.tsx     ← Related entity + frequency
│
└── ui/
    ├── Skeleton.tsx              ← Loading state
    └── EmptyState.tsx            ← No data message
```

### API Design

#### Endpoint: `GET /api/entity/:id`

**Query Params:**
```typescript
{
  window: 'now' | '24h' | '7d',
  includeReceipts?: boolean,     // Default: true
  includeTimeline?: boolean,     // Default: false
  includeNetwork?: boolean       // Default: false
}
```

**Response Schema:**
```typescript
{
  entity: {
    id: string;
    name: string;
    type: 'character' | 'show' | 'storyline' | 'chatter' | 'clipper';
    aliases: string[];
    imageUrl?: string;
  },
  
  currentStats: {
    rank: number;
    score: number;
    momentum: number;
    percentile: number;
    driver: string;
    rankChange: number;           // +2, -1, 0, null (new)
    lastUpdated: string;          // ISO timestamp
  },
  
  trend: {
    window: string;               // "6h", "24h", "7d"
    dataPoints: Array<{
      timestamp: string;
      score: number;
      rank: number | null;        // null if not in Top 10
      momentum: number;
    }>;
    minScore: number;
    maxScore: number;
  },
  
  sourceBreakdown: {
    youtube: {
      velocity: number;           // Raw count
      normalized: number;         // Weighted contribution
      percentage: number;         // % of total
      topChannel?: string;
    },
    reddit: {
      velocity: number;
      normalized: number;
      percentage: number;
      topSubreddit?: string;
    }
  },
  
  receipts: Array<{
    id: string;
    type: 'video' | 'post' | 'comment';
    platform: 'youtube' | 'reddit';
    title: string;
    url: string;
    thumbnailUrl?: string;
    author: string;
    createdAt: string;
    scoreContribution: number;    // How much this added to score
    driver: string;               // Which driver label it triggered
    engagementMetrics: {
      views?: number;
      likes?: number;
      upvotes?: number;
      comments?: number;
    };
  }>;
  
  driverHistory: Array<{
    driver: string;
    startedAt: string;
    endedAt: string | null;       // null if current
    durationHours: number;
    triggeringEvent?: {
      id: string;
      title: string;
    };
  }>;
  
  coMentions: Array<{
    entity: {
      id: string;
      name: string;
      type: string;
      rank: number | null;
    };
    frequency: number;            // Times mentioned together
    recentEvent: {
      id: string;
      title: string;
      createdAt: string;
    };
    context: string;              // "co-star", "rival", "topic"
  }>;
  
  confidence: {
    level: 'low' | 'medium' | 'high';
    dataCompleteness: number;     // 0-1
    aliasMatchQuality: number;    // 0-1
    reasons: string[];            // ["Limited Reddit data", ...]
  };
}
```

### Database Queries

**File:** `lib/utils/entityQueries.ts`

```typescript
import { db } from '@/lib/db';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { entities, scores, items, events, eventEntityLinks } from '@/lib/db/schema';
import type { WindowType } from '@/lib/types';

export async function getEntityDetails(
  entityId: string,
  window: WindowType,
  options: {
    includeReceipts?: boolean;
    includeTimeline?: boolean;
    includeNetwork?: boolean;
  } = {}
) {
  // Get entity base info
  const entity = await db.query.entities.findFirst({
    where: eq(entities.id, entityId),
    with: {
      aliases: true,
    },
  });

  if (!entity) {
    throw new Error('Entity not found');
  }

  // Get current score
  const currentScore = await db.query.scores.findFirst({
    where: and(
      eq(scores.entityId, entityId),
      eq(scores.window, window)
    ),
    orderBy: desc(scores.computedAt),
  });

  // Get trend data (last 50 data points)
  const trendData = await db
    .select({
      timestamp: scores.computedAt,
      score: scores.score,
      rank: scores.rank,
      momentum: scores.momentum,
    })
    .from(scores)
    .where(
      and(
        eq(scores.entityId, entityId),
        eq(scores.window, window),
        gte(scores.computedAt, getWindowStart(window))
      )
    )
    .orderBy(desc(scores.computedAt))
    .limit(50);

  // Get source breakdown
  const sourceBreakdown = await getSourceBreakdown(entityId, window);

  // Optional: Get receipts (top items)
  let receipts = [];
  if (options.includeReceipts !== false) {
    receipts = await getTopReceipts(entityId, window, 10);
  }

  // Optional: Get driver history
  let driverHistory = [];
  if (options.includeTimeline) {
    driverHistory = await getDriverHistory(entityId, window);
  }

  // Optional: Get co-mentions
  let coMentions = [];
  if (options.includeNetwork) {
    coMentions = await getCoMentions(entityId, window, 10);
  }

  return {
    entity: {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      aliases: entity.aliases.map(a => a.text),
    },
    currentStats: {
      rank: currentScore?.rank || null,
      score: currentScore?.score || 0,
      momentum: currentScore?.momentum || 0,
      percentile: currentScore?.percentile || 0,
      driver: currentScore?.driver || 'unknown',
      rankChange: currentScore?.rankChange || 0,
      lastUpdated: currentScore?.computedAt || new Date(),
    },
    trend: {
      window,
      dataPoints: trendData.reverse(),
      minScore: Math.min(...trendData.map(d => d.score)),
      maxScore: Math.max(...trendData.map(d => d.score)),
    },
    sourceBreakdown,
    receipts,
    driverHistory,
    coMentions,
    confidence: calculateConfidence(entity, currentScore),
  };
}

// Helper functions (implement these)
async function getSourceBreakdown(entityId: string, window: WindowType) {
  // Query items linked to this entity, group by platform
  // Calculate velocity, normalized score, percentage
  // Return { youtube: {...}, reddit: {...} }
}

async function getTopReceipts(entityId: string, window: WindowType, limit: number) {
  // Query items linked to this entity
  // Order by score_contribution DESC
  // Join with events to get dedup info
  // Return array of receipt objects
}

async function getDriverHistory(entityId: string, window: WindowType) {
  // Query scores table for this entity
  // Detect driver changes over time
  // Return timeline of driver switches
}

async function getCoMentions(entityId: string, window: WindowType, limit: number) {
  // Query events where this entity appears
  // Find other entities in same events
  // Count frequency, get recent context
  // Return sorted by frequency
}

function calculateConfidence(entity: any, score: any) {
  // Logic to determine data quality
  // Check: alias count, recent activity, data completeness
  // Return { level, dataCompleteness, reasons }
}
```

### Frontend Implementation

**File:** `components/entity/EntityDrawer.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { WindowType } from '@/lib/types';
import EntityHeader from './EntityHeader';
import OverviewTab from './tabs/OverviewTab';
import ReceiptsTab from './tabs/ReceiptsTab';
import TimelineTab from './tabs/TimelineTab';
import NetworkTab from './tabs/NetworkTab';
import Skeleton from './ui/Skeleton';

interface EntityDrawerProps {
  entityId: string | null;
  window: WindowType;
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'overview' | 'receipts' | 'timeline' | 'network';

export default function EntityDrawer({ 
  entityId, 
  window, 
  isOpen, 
  onClose 
}: EntityDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch entity data when drawer opens
  useEffect(() => {
    if (!entityId || !isOpen) {
      setData(null);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const includeTimeline = activeTab === 'timeline';
        const includeNetwork = activeTab === 'network';
        
        const response = await fetch(
          `/api/entity/${entityId}?window=${window}&includeTimeline=${includeTimeline}&includeNetwork=${includeNetwork}`
        );
        
        if (!response.ok) {
          throw new Error('Failed to load entity data');
        }
        
        const json = await response.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [entityId, window, isOpen, activeTab]);

  // Close on ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when drawer open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
        style={{ 
          opacity: isOpen ? 1 : 0,
          transition: 'opacity 300ms ease-in-out'
        }}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 h-full w-full md:w-[600px] lg:w-[800px] z-50 overflow-y-auto"
        style={{
          backgroundColor: 'var(--color-broadcast-bg)',
          borderLeft: '1px solid var(--color-broadcast-border)',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 300ms ease-in-out',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/5"
          aria-label="Close drawer"
        >
          <X size={24} style={{ color: 'var(--color-text-primary)' }} />
        </button>

        {/* Content */}
        <div className="p-6 pt-16">
          {loading && <Skeleton />}
          
          {error && (
            <div className="text-center py-12">
              <p style={{ color: 'var(--color-broadcast-accent)' }}>
                {error}
              </p>
            </div>
          )}
          
          {data && (
            <>
              <EntityHeader 
                entity={data.entity}
                stats={data.currentStats}
                confidence={data.confidence}
              />

              {/* Tabs */}
              <div className="flex gap-4 border-b mt-6" style={{ borderColor: 'var(--color-broadcast-border)' }}>
                {(['overview', 'receipts', 'timeline', 'network'] as TabType[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="px-4 py-3 font-semibold capitalize"
                    style={{
                      color: activeTab === tab 
                        ? 'var(--color-broadcast-accent)' 
                        : 'var(--color-text-secondary)',
                      borderBottom: activeTab === tab 
                        ? '2px solid var(--color-broadcast-accent)' 
                        : '2px solid transparent',
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="mt-6">
                {activeTab === 'overview' && (
                  <OverviewTab
                    trend={data.trend}
                    sourceBreakdown={data.sourceBreakdown}
                    stats={data.currentStats}
                  />
                )}
                
                {activeTab === 'receipts' && (
                  <ReceiptsTab receipts={data.receipts} />
                )}
                
                {activeTab === 'timeline' && (
                  <TimelineTab driverHistory={data.driverHistory} />
                )}
                
                {activeTab === 'network' && (
                  <NetworkTab coMentions={data.coMentions} />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
```

**Wire to ScoreboardTable:**

```typescript
// In app/page.tsx
const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
const [drawerOpen, setDrawerOpen] = useState(false);

const handleRowClick = (entityId: string) => {
  setSelectedEntityId(entityId);
  setDrawerOpen(true);
};

return (
  <>
    <ScoreboardTable 
      data={scoreboardData}
      onRowClick={handleRowClick}
    />
    
    <EntityDrawer
      entityId={selectedEntityId}
      window={selectedWindow}
      isOpen={drawerOpen}
      onClose={() => setDrawerOpen(false)}
    />
  </>
);
```

---

## 🎯 Feature 2: Enhanced "What Changed" Rail

### Component Structure

**File:** `components/scoreboard/ChangesRail.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Star, Flame, ArrowLeftRight } from 'lucide-react';
import type { WindowType } from '@/lib/types';

interface ChangesRailProps {
  window: WindowType;
}

interface ChangeData {
  risers: Array<{
    entityId: string;
    name: string;
    type: string;
    momentum: number;
    oldRank: number | null;
    newRank: number;
  }>;
  fallers: Array<{
    entityId: string;
    name: string;
    type: string;
    momentum: number;
    oldRank: number;
    newRank: number | null;
  }>;
  newEntrants: Array<{
    entityId: string;
    name: string;
    type: string;
    rank: number;
    since: string;
  }>;
  overheated: Array<{
    entityId: string;
    name: string;
    type: string;
    microMomentum: number;
    currentRank: number;
  }>;
}

export default function ChangesRail({ window }: ChangesRailProps) {
  const [changes, setChanges] = useState<ChangeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChanges = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/changes?window=${window}`);
        const data = await response.json();
        setChanges(data);
      } catch (error) {
        console.error('Failed to fetch changes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchChanges();
  }, [window]);

  if (loading || !changes) {
    return <div className="p-6">Loading changes...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Biggest Risers */}
      <ChangeSection
        title="🔥 Biggest Risers"
        icon={<TrendingUp size={20} style={{ color: '#10b981' }} />}
        items={changes.risers.slice(0, 5)}
        renderItem={(item) => (
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {item.name}
              </div>
              <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                #{item.newRank} {item.oldRank && `(+${item.oldRank - item.newRank})`}
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-green-500">
                +{item.momentum.toFixed(1)}%
              </div>
            </div>
          </div>
        )}
      />

      {/* Biggest Fallers */}
      <ChangeSection
        title="📉 Biggest Fallers"
        icon={<TrendingDown size={20} style={{ color: '#ef4444' }} />}
        items={changes.fallers.slice(0, 5)}
        renderItem={(item) => (
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {item.name}
              </div>
              <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {item.newRank ? `#${item.newRank}` : 'Out'} 
                {item.newRank && ` (${item.newRank - item.oldRank})`}
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-red-500">
                {item.momentum.toFixed(1)}%
              </div>
            </div>
          </div>
        )}
      />

      {/* New Entrants */}
      {changes.newEntrants.length > 0 && (
        <ChangeSection
          title="⭐ New Entrants"
          icon={<Star size={20} style={{ color: '#f59e0b' }} />}
          items={changes.newEntrants}
          renderItem={(item) => (
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {item.name}
                </div>
                <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  #{item.rank}
                </div>
              </div>
              <div className="text-xs px-2 py-1 rounded" style={{ 
                backgroundColor: 'var(--color-broadcast-accent-dim)',
                color: 'var(--color-broadcast-accent)'
              }}>
                NEW
              </div>
            </div>
          )}
        />
      )}

      {/* Overheated */}
      {changes.overheated.length > 0 && (
        <ChangeSection
          title="⚡ Overheated"
          icon={<Flame size={20} style={{ color: '#f97316' }} />}
          items={changes.overheated}
          renderItem={(item) => (
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {item.name}
                </div>
                <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  #{item.currentRank}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-orange-500">
                  {item.microMomentum.toFixed(0)}% micro
                </div>
                <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  (last hour)
                </div>
              </div>
            </div>
          )}
        />
      )}
    </div>
  );
}

// Helper component
function ChangeSection({ 
  title, 
  icon, 
  items, 
  renderItem 
}: {
  title: string;
  icon: React.ReactNode;
  items: any[];
  renderItem: (item: any) => React.ReactNode;
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>
          {title}
        </h3>
      </div>
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div
            key={item.entityId || idx}
            className="p-3 rounded-lg"
            style={{ backgroundColor: 'var(--color-broadcast-panel)' }}
          >
            {renderItem(item)}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### API Endpoint

**File:** `app/api/changes/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getChanges } from '@/lib/utils/queries';
import { getCache, setCache } from '@/lib/utils/redis';
import type { WindowType } from '@/lib/types';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const window = searchParams.get('window') as WindowType || 'now';

  // Try cache first
  const cacheKey = `changes:${window}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  // Fetch changes
  const changes = await getChanges(window);

  // Cache for 60 seconds
  await setCache(cacheKey, changes, 60);

  return NextResponse.json(changes);
}
```

**Database Query:** `lib/utils/queries.ts`

```typescript
export async function getChanges(window: WindowType) {
  // Get current scores
  const currentScores = await db.query.scores.findMany({
    where: eq(scores.window, window),
    orderBy: desc(scores.computedAt),
    limit: 100, // Get more than Top 10 to detect fallers
  });

  // Get scores from previous computation
  const previousScores = await db.query.scores.findMany({
    where: and(
      eq(scores.window, window),
      lt(scores.computedAt, currentScores[0]?.computedAt)
    ),
    orderBy: desc(scores.computedAt),
    limit: 100,
  });

  // Calculate changes
  const risers = [];
  const fallers = [];
  const newEntrants = [];
  const overheated = [];

  for (const current of currentScores) {
    const previous = previousScores.find(p => p.entityId === current.entityId);
    
    if (!previous) {
      // New entrant
      if (current.rank <= 10) {
        newEntrants.push({
          entityId: current.entityId,
          name: current.entityName,
          type: current.entityType,
          rank: current.rank,
          since: current.computedAt,
        });
      }
    } else {
      const rankChange = previous.rank - current.rank;
      
      // Risers (improved rank)
      if (rankChange > 0) {
        risers.push({
          entityId: current.entityId,
          name: current.entityName,
          type: current.entityType,
          momentum: current.momentum,
          oldRank: previous.rank,
          newRank: current.rank,
        });
      }
      
      // Fallers (worse rank or dropped out)
      if (rankChange < 0 || (previous.rank <= 10 && current.rank > 10)) {
        fallers.push({
          entityId: current.entityId,
          name: current.entityName,
          type: current.entityType,
          momentum: current.momentum,
          oldRank: previous.rank,
          newRank: current.rank <= 10 ? current.rank : null,
        });
      }
    }
    
    // Overheated (micro-momentum high but not reflected in rank yet)
    if (current.microMomentum > 50 && current.momentum > 20) {
      overheated.push({
        entityId: current.entityId,
        name: current.entityName,
        type: current.entityType,
        microMomentum: current.microMomentum,
        currentRank: current.rank,
      });
    }
  }

  // Sort by magnitude
  risers.sort((a, b) => b.momentum - a.momentum);
  fallers.sort((a, b) => a.momentum - b.momentum);

  return {
    risers: risers.slice(0, 10),
    fallers: fallers.slice(0, 10),
    newEntrants,
    overheated,
  };
}
```

---

## 🎯 Feature 3: Ticker Auto-Advance

### Enhanced TickerDock

**File:** `components/ticker/TickerDock.tsx` (modifications)

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import type { FeedCardData } from '@/lib/types';

export default function TickerDock({ 
  initialFeed,
  onCardClick 
}: { 
  initialFeed: FeedCardData[];
  onCardClick?: (entityId: string, eventId: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [feed, setFeed] = useState(initialFeed);

  // Auto-advance scroll
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      if (scrollRef.current) {
        const container = scrollRef.current;
        const cardWidth = 320; // w-80 = 320px
        const gap = 16; // gap-4 = 16px
        const scrollAmount = cardWidth + gap;
        
        // Check if at end
        const isAtEnd = 
          container.scrollLeft + container.clientWidth >= 
          container.scrollWidth - 10;
        
        if (isAtEnd) {
          // Loop back to start
          container.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          // Scroll to next card
          container.scrollBy({ 
            left: scrollAmount, 
            behavior: 'smooth' 
          });
        }
      }
    }, 7000); // 7 seconds per card

    return () => clearInterval(interval);
  }, [isPaused]);

  // Fetch new feed data periodically
  useEffect(() => {
    const fetchInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/feed?window=now');
        const newFeed = await response.json();
        setFeed(newFeed);
      } catch (error) {
        console.error('Failed to refresh feed:', error);
      }
    }, 60000); // Refresh every 60 seconds

    return () => clearInterval(fetchInterval);
  }, []);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 h-[240px] md:h-[210px]"
      style={{
        backgroundColor: 'var(--color-broadcast-panel)',
        borderTop: '2px solid var(--color-broadcast-border)',
      }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b" 
          style={{ borderColor: 'var(--color-broadcast-border)' }}
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <h3 className="font-bold text-base md:text-lg" 
              style={{ color: 'var(--color-text-primary)' }}
            >
              <span className="hidden md:inline">Live Feed</span>
              <span className="md:hidden">Feed</span>
            </h3>
          </div>
          
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="p-2 rounded-lg hover:bg-white/5"
            aria-label={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? (
              <Play size={16} style={{ color: 'var(--color-text-secondary)' }} />
            ) : (
              <Pause size={16} style={{ color: 'var(--color-text-secondary)' }} />
            )}
          </button>
        </div>

        {/* Scrollable cards */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-x-auto overflow-y-hidden px-4 md:px-6 py-4 flex gap-4"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {feed.map((card, idx) => (
            <div
              key={`${card.itemId}-${idx}`}
              className="flex-shrink-0 w-72 md:w-80 p-4 rounded-lg cursor-pointer hover:ring-2"
              style={{
                backgroundColor: 'var(--color-broadcast-bg)',
                border: '1px solid var(--color-broadcast-border)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-broadcast-accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-broadcast-border)';
              }}
              onClick={() => {
                if (onCardClick) {
                  onCardClick(card.entityId, card.eventId);
                }
              }}
            >
              {/* Card content */}
              <div className="flex items-start gap-3">
                {/* Badge */}
                <div
                  className="px-2 py-1 text-xs font-bold rounded uppercase flex-shrink-0"
                  style={{
                    backgroundColor: card.platform === 'youtube' 
                      ? 'rgba(255, 0, 0, 0.2)'
                      : 'rgba(255, 69, 0, 0.2)',
                    color: card.platform === 'youtube' ? '#ff0000' : '#ff4500',
                  }}
                >
                  {card.platform === 'youtube' ? 'YT' : 'RDT'}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Entity name */}
                  <div
                    className="font-semibold text-sm truncate"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {card.entityName}
                  </div>

                  {/* Title */}
                  <div
                    className="text-xs mt-1 line-clamp-2"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {card.title}
                  </div>

                  {/* Why it matters */}
                  {card.whyItMatters && (
                    <div
                      className="text-xs mt-2 italic"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      {card.whyItMatters}
                    </div>
                  )}

                  {/* Dedup indicator */}
                  {card.itemCount > 1 && (
                    <div
                      className="text-xs mt-2 font-semibold"
                      style={{ color: 'var(--color-broadcast-accent)' }}
                    >
                      1 event • {card.itemCount} related posts
                    </div>
                  )}

                  {/* Time ago */}
                  <div
                    className="text-xs mt-1"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    {card.timeAgo}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Wire to Entity Drawer:**

```typescript
// In app/page.tsx
const handleFeedCardClick = (entityId: string, eventId: string) => {
  setSelectedEntityId(entityId);
  setDrawerOpen(true);
  // Optional: scroll to specific receipt in drawer
};

<TickerDock 
  initialFeed={feedData}
  onCardClick={handleFeedCardClick}
/>
```

---

## 📊 Testing Checklist

### Entity Hub Drawer
- [ ] Opens on row click (desktop + mobile)
- [ ] Closes on backdrop click
- [ ] Closes on ESC key
- [ ] Prevents body scroll when open
- [ ] Shows loading skeleton while fetching
- [ ] Displays error state gracefully
- [ ] Tabs switch correctly
- [ ] Trend chart renders with data
- [ ] Receipts list is clickable (opens external links)
- [ ] Source breakdown shows correct %
- [ ] Responsive on mobile (full width)
- [ ] Animations are smooth (300ms transition)

### Changes Rail
- [ ] Fetches on mount
- [ ] Updates when window changes
- [ ] Shows risers/fallers correctly
- [ ] Displays "NEW" badge for entrants
- [ ] Overheated section appears when relevant
- [ ] Empty sections are hidden
- [ ] Momentum values are accurate

### Ticker Auto-Advance
- [ ] Scrolls every 7 seconds
- [ ] Pauses on hover
- [ ] Resumes on mouse leave
- [ ] Loops back to start at end
- [ ] Play/pause button works
- [ ] Cards are clickable
- [ ] Opens Entity Drawer on click
- [ ] Dedup indicator shows when > 1 item
- [ ] Fetches new feed every 60s
- [ ] Smooth scroll animation

---

## 🚀 Deployment Sequence

1. **Day 1-2:** Build Entity Drawer UI components (no API yet)
2. **Day 3:** Build `/api/entity/:id` endpoint + queries
3. **Day 4:** Wire Entity Drawer to ScoreboardTable
4. **Day 5:** Build Changes Rail + `/api/changes` endpoint
5. **Day 6:** Enhance Ticker auto-advance logic
6. **Day 7:** Testing, bug fixes, mobile polish
7. **Day 8:** Deploy to staging, user testing

---

## 💡 Quick Wins (Can Ship Immediately)

### 1. Fix X Pill Visibility (30 minutes)
```typescript
// In SourcePills.tsx
const activeSources = Object.entries(sources).filter(([platform]) => 
  platform !== 'x' // Hide X until Phase 3
);
```

### 2. Add Hover Preview on Rows (1 hour)
```typescript
// In ScoreboardTable.tsx
const [hoveredRow, setHoveredRow] = useState<string | null>(null);

<tr
  onMouseEnter={() => setHoveredRow(row.entityId)}
  onMouseLeave={() => setHoveredRow(null)}
  style={{
    transform: hoveredRow === row.entityId ? 'translateX(4px)' : 'none',
    transition: 'transform 200ms ease-out',
  }}
>
```

### 3. Add Search to Masthead (2 hours)
```typescript
// In Masthead.tsx
const [searchQuery, setSearchQuery] = useState('');

<input
  type="search"
  placeholder="Search entities..."
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  className="px-4 py-2 rounded-lg"
  style={{
    backgroundColor: 'var(--color-broadcast-panel)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-broadcast-border)',
  }}
/>
```

---

**Status:** Ready for sprint kickoff  
**Recommended Start:** Entity Hub Drawer (highest impact)  
**Est. Completion:** 7-8 days for all TIER 1 features  
**Next Review:** After Entity Hub Drawer is live

