# Dabbleverse Dashboard (thedabbleverse.com)

A real-time "cultural stock ticker" for the Dabbleverse ecosystem that ranks Characters, Storylines, and Shows across YouTube and Reddit with an ESPN-style scoreboard UI.

## 🎯 Product Overview

**One-sentence definition:** A real-time cultural stock ticker for the Dabbleverse ecosystem that ranks Characters, Storylines, and Shows across YouTube, X, and Reddit, with an ESPN-style scoreboard UI and a live bottom ticker showing the receipts that drove ranking movement.

### Core Features

- **ESPN-Style Scoreboard:** Real-time rankings with momentum indicators
- **Live Bottom Ticker:** Continuous feed of deduped events driving movement
- **What Moved Rail:** Top movers sorted by momentum with driver classification
- **Time Windows:** Now (6h), 24h, 7d with momentum calculations
- **Driver Classification:** Clip Spike, Dunk Thread, Reddit Consolidation, etc.

## 🏗️ Tech Stack

### Frontend
- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** (broadcast dark theme)
- Auto-refresh (30-60s cadence)

### Backend
- **Next.js Route Handlers** for API
- **Drizzle ORM** + PostgreSQL
- **Redis** for caching
- **BullMQ** for job queues

### Ingestion
- **YouTube Data API** (Phase 1)
- **Reddit API** (Phase 2)
- Twitter/X API (Phase 3)

### Deployment
- **Railway** (Web + Worker + Postgres + Redis)
- **Cloudflare** (DNS + CDN + WAF)

## 📦 Project Structure

```
dabbleverse/
├── app/                      # Next.js App Router
│   ├── api/                  # API route handlers
│   │   ├── scoreboard/       # GET /api/scoreboard
│   │   ├── movers/           # GET /api/movers
│   │   └── feed/             # GET /api/feed
│   ├── page.tsx              # Homepage with scoreboard
│   └── layout.tsx            # Root layout
├── components/               # React components
│   ├── ui/                   # Base UI components (badges, bars)
│   ├── scoreboard/           # Scoreboard components
│   └── ticker/               # Ticker dock components
├── lib/                      # Core logic
│   ├── db/                   # Database (Drizzle schema + client)
│   ├── scoring/              # Scoring algorithm + deduplication
│   ├── ingestion/            # YouTube + Reddit ingestion
│   ├── jobs/                 # BullMQ job definitions
│   └── utils/                # Redis cache, queries, types
├── seed/                     # Seed data (JSON files)
│   ├── watchlists/           # YouTube channels + Reddit subs
│   └── entities/             # Entities + aliases
├── workers/                  # BullMQ worker processes
└── scripts/                  # Utility scripts (seed, etc.)
```

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- YouTube Data API key
- Reddit API credentials

### Installation

1. **Clone and install dependencies:**
```bash
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env.local
# Edit .env.local with your credentials
```

3. **Set up database:**
```bash
npm run db:push        # Push schema to database
npm run seed           # Seed initial data
```

4. **Run development server:**
```bash
npm run dev            # Start Next.js (port 3000)
npm run worker:dev     # Start workers (separate terminal)
```

5. **Open browser:**
```
http://localhost:3000
```

## 🗄️ Database Schema

### Core Tables

- **entities:** Characters, Storylines, Shows, Chatters, Clippers
- **entity_aliases:** Matching patterns per entity
- **items:** Raw content from platforms
- **events:** Deduped clusters of items
- **scores:** Time-windowed rankings (now/24h/7d)
- **feed_cards:** Precomputed ticker output
- **watchlists:** YouTube channels + Reddit subs

### Time Windows

- **Now:** Last 6 hours
- **24h:** Rolling 24 hours
- **7d:** Rolling 7 days

### Momentum Calculation

- **Now:** Last 3h vs prior 3h
- **24h:** Last 12h vs prior 12h
- **7d:** Last 24h vs prior 24h
- **Micro-momentum:** Last 60m vs prior 60m (for "heating up" flag)

## 📊 Scoring System

### Platform Weights

- YouTube: 1.0 (views, likes, comments)
- Reddit: 1.0 (upvotes, comments)
- X/Twitter: 0.0 (Phase 3)

### Driver Labels

1. **Clip Spike:** YouTube-heavy, sudden velocity (Now window)
2. **Dunk Thread:** X-heavy, high reply rate (Phase 3)
3. **Reddit Consolidation:** Reddit-heavy, many events
4. **Cross-Platform Pickup:** Balanced across platforms
5. **Comeback:** Re-entry to top 10 after absence
6. **Slow Burn:** Steady 7d growth
7. **Heating Up:** Micro-momentum > 50%

## 🔧 Configuration

### Seed Data Files

Edit these JSON files to configure the system:

- `seed/watchlists/youtube.json` - YouTube channels to monitor
- `seed/watchlists/reddit.json` - Subreddits to monitor
- `seed/entities/entities.json` - Characters, Storylines, Shows
- `seed/entities/aliases.json` - Matching patterns per entity

After editing, run:
```bash
npm run seed
```

## 🚢 Deployment

### Railway Setup

1. **Create Railway project:**
```bash
railway init
```

2. **Add services:**
- Web (Next.js)
- Worker (BullMQ workers)
- PostgreSQL
- Redis

3. **Set environment variables in Railway:**
```
DATABASE_URL (auto-provided)
REDIS_URL (auto-provided)
YOUTUBE_API_KEY
REDDIT_CLIENT_ID
REDDIT_CLIENT_SECRET
REDDIT_USER_AGENT
NEXT_PUBLIC_SITE_URL
```

4. **Deploy:**
```bash
railway up
```

### Cloudflare Setup

1. Add domain to Cloudflare
2. Point DNS to Railway
3. Enable CDN with 30s TTL
4. Enable WAF basics

## 📝 API Endpoints

### GET /api/scoreboard
```
?window=now|24h|7d
&type=all|character|storyline|show
```

### GET /api/movers
```
?window=now|24h|7d
```

### GET /api/feed
```
?window=now|24h|7d
```

### Response Format

All endpoints return JSON with:
- `computedAt`: ISO timestamp
- `window`: Current time window
- Data array (rows/movers/cards)

## 🛠️ Development Commands

```bash
# Development
npm run dev              # Start Next.js dev server
npm run worker:dev       # Start workers with auto-reload

# Database
npm run db:generate      # Generate Drizzle migrations
npm run db:push          # Push schema to database
npm run db:studio        # Open Drizzle Studio (GUI)
npm run seed             # Run seed script

# Production
npm run build            # Build for production
npm run start            # Start production server
npm run worker           # Start workers
```

## 🎨 Design System

### Color Tokens

- **Background:** `broadcast-bg`, `broadcast-surface`, `broadcast-panel`
- **Text:** `text-primary`, `text-secondary`, `text-tertiary`
- **Momentum:** `momentum-up`, `momentum-down`, `momentum-neutral`
- **Sources:** `source-youtube`, `source-reddit`, `source-x`

### Components

- `broadcast-card` - Base card component
- `scoreboard-row` - Scoreboard row (zebra + hover)
- `source-pill` - Platform badge
- `momentum-badge` - Momentum indicator
- `rank-badge` - Rank display (gold/silver/bronze)
- `driver-label` - Driver classification badge
- `ticker-card` - Ticker dock card

## 🔒 Security Notes

- Never commit `.env.local`
- Rate-limit API endpoints (Cloudflare)
- Sanitize all user inputs
- Use HTTPS only in production
- Rotate API keys regularly

## 📈 Phase Roadmap

### Phase 1 (MVP) ✅
- ESPN layout + design system
- YouTube ingestion
- Scoreboard + ticker + rail
- Now/24h/7d windows
- Railway + Cloudflare deployment

### Phase 2
- Reddit ingestion
- Entity profile pages
- Driver classifier v2
- Watchlist/favorites
- Methodology page

### Phase 3
- X/Twitter ingestion (with stable API access)
- Better clustering + alias system
- Breakout alerts
- Admin console

## 🤝 Contributing

This is a private project. For questions, contact the project owner.

## 📄 License

Proprietary - All rights reserved
