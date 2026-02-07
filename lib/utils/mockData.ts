import {
  ScoreboardResponse,
  MoversResponse,
  FeedResponse,
  WindowType,
  DriverLabel,
} from '@/lib/types';

// Mock data generator for development (until ingestion pipeline is live)

const REAL_ENTITIES = [
  // Characters
  { id: 'char-stuttering-john', name: 'Stuttering John Melendez', type: 'character' as const },
  { id: 'char-karl-hamburger', name: 'Karl Hamburger', type: 'character' as const },
  { id: 'char-shuli-egar', name: 'Shuli Egar', type: 'character' as const },
  { id: 'char-bob-levy', name: 'Bob Levy', type: 'character' as const },
  { id: 'char-kevin-brennan', name: 'Kevin Brennan', type: 'character' as const },
  { id: 'char-chad-zumock', name: 'Chad Zumock', type: 'character' as const },
  { id: 'char-clearwater-chad', name: 'Clearwater Chad', type: 'character' as const },
  { id: 'char-scarlett-hampton', name: 'Scarlett Hampton', type: 'character' as const },
  { id: 'char-big-dub', name: 'Big Dub', type: 'character' as const },
  { id: 'char-cardiff-electric', name: 'Cardiff Electric', type: 'character' as const },
  { id: 'char-producer-joe', name: 'Producer Joe', type: 'character' as const },
  { id: 'char-tookie', name: 'Tookie', type: 'character' as const },
  { id: 'char-noz', name: 'Noz', type: 'character' as const },
  { id: 'char-vinnie-paulino', name: 'Vinnie Paulino', type: 'character' as const },
  { id: 'char-anthony-cumia', name: 'Anthony Cumia', type: 'character' as const },
  { id: 'char-joe-cumia', name: 'Joe Cumia', type: 'character' as const },
  { id: 'char-opie', name: 'Opie', type: 'character' as const },
  { id: 'char-jim-norton', name: 'Jim Norton', type: 'character' as const },
  { id: 'char-artie-lange', name: 'Artie Lange', type: 'character' as const },
  { id: 'char-mike-morse', name: 'Mike Morse', type: 'character' as const },
  { id: 'char-lady-k', name: 'Lady K', type: 'character' as const },
  { id: 'char-patrick-melton', name: 'Patrick Melton', type: 'character' as const },
  { id: 'char-steel-toe', name: 'Steel Toe', type: 'character' as const },
  { id: 'char-april-imholte', name: 'April Imholte', type: 'character' as const },
  { id: 'char-blind-mike', name: 'Blind Mike', type: 'character' as const },
  { id: 'char-eric-zane', name: 'Eric Zane', type: 'character' as const },
  { id: 'char-chrissie-mayr', name: 'Chrissie Mayr', type: 'character' as const },
  { id: 'char-bryan-johnson', name: 'Bryan Johnson', type: 'character' as const },
  { id: 'char-vic', name: 'Vic', type: 'character' as const },
  { id: 'char-keanu-thompson', name: 'Keanu Thompson', type: 'character' as const },
  { id: 'char-ray-devito', name: 'Ray DeVito', type: 'character' as const },
  { id: 'char-brendan-sagalow', name: 'Brendan Sagalow', type: 'character' as const },
  { id: 'char-aaron-berg', name: 'Aaron Berg', type: 'character' as const },
  { id: 'char-geno-bisconte', name: 'Geno Bisconte', type: 'character' as const },
  { id: 'char-drew-lane', name: 'Drew Lane', type: 'character' as const },
  { id: 'char-doug', name: 'Doug', type: 'character' as const },
  { id: 'char-jamie-lorello', name: 'Jamie Lorello', type: 'character' as const },
  { id: 'char-joey-c', name: 'Joey C', type: 'character' as const },
  { id: 'char-lucy-tightbox', name: 'Lucy Tightbox', type: 'character' as const },
  { id: 'char-sal-d', name: 'Sal D', type: 'character' as const },
  { id: 'char-chille-decastro', name: 'Chille DeCastro', type: 'character' as const },
  { id: 'char-ava-raiza', name: 'Ava Raiza', type: 'character' as const },
  { id: 'char-andrea-landis', name: 'Andrea Landis', type: 'character' as const },
  { id: 'char-benniloco', name: 'Benniloco', type: 'character' as const },
  { id: 'char-bill-burr', name: 'Bill Burr', type: 'character' as const },
  { id: 'char-adam-busch', name: 'Adam Busch', type: 'character' as const },
  { id: 'char-adam-post', name: 'Adam Post', type: 'character' as const },
  { id: 'char-ali-weezy', name: 'Ali Weezy', type: 'character' as const },
  { id: 'char-army-major', name: 'Army Major', type: 'character' as const },
  { id: 'char-jay-moe', name: 'Jay Moe', type: 'character' as const },
  { id: 'char-stealthkaos', name: 'StealthKaos', type: 'character' as const },
  { id: 'char-dr-chow', name: 'DR Chow', type: 'character' as const },
  { id: 'char-lil-mir', name: 'Lil Mir', type: 'character' as const },
  { id: 'char-quadfather', name: 'Quadfather', type: 'character' as const },
  { id: 'char-matt-mead', name: 'Matt Mead', type: 'character' as const },
  { id: 'char-ethan-ralph', name: 'Ethan Ralph', type: 'character' as const },
  // Shows
  { id: 'show-dabbleverse', name: 'Dabbleverse', type: 'show' as const },
  { id: 'show-hackverse', name: 'Hackverse', type: 'show' as const },
  { id: 'show-stuttering-john-franchise', name: 'Stuttering John Show', type: 'show' as const },
  // Storylines
  { id: 'storyline-feud-template', name: 'On-air Feud', type: 'storyline' as const },
  { id: 'storyline-ban-drama', name: 'Ban Drama', type: 'storyline' as const },
  { id: 'storyline-clip-spike', name: 'Viral Clip Moment', type: 'storyline' as const },
  // Chatters (placeholder)
  { id: 'chatter-receipts-guy', name: 'ReceiptsGuy', type: 'chatter' as const },
  { id: 'chatter-timestamp-hero', name: 'TimestampHero', type: 'chatter' as const },
  { id: 'chatter-drama-summarizer', name: 'DramaSummarizer', type: 'chatter' as const },
  // Clippers (placeholder)
  { id: 'clipper-dabble-clips', name: 'Dabble Clips Official', type: 'clipper' as const },
  { id: 'clipper-best-of-sj', name: 'Best of Stuttering John', type: 'clipper' as const },
  { id: 'clipper-hackverse-highlights', name: 'Hackverse Highlights', type: 'clipper' as const },
];

const DRIVERS: DriverLabel[] = [
  'clip_spike',
  'dunk_thread',
  'reddit_consolidation',
  'cross_platform_pickup',
  'comeback',
  'slow_burn',
];

function randomScore() {
  return Math.random() * 100;
}

function randomMomentum() {
  return (Math.random() - 0.5) * 200; // -100 to +100
}

function randomDeltaRank() {
  return Math.floor((Math.random() - 0.5) * 10);
}

function randomSources() {
  const youtube = Math.random();
  const reddit = Math.random() * (1 - youtube);
  const x = 1 - youtube - reddit;
  return { youtube, reddit, x };
}

export function generateMockScoreboard(window: WindowType): ScoreboardResponse {
  const rows = REAL_ENTITIES
    .map((entity, index) => ({
      rank: index + 1,
      deltaRank: randomDeltaRank(),
      entityId: entity.id,
      name: entity.name,
      type: entity.type,
      score: randomScore(),
      momentum: randomMomentum(),
      microMomentum: Math.random() * 100,
      sources: randomSources(),
      driver: DRIVERS[Math.floor(Math.random() * DRIVERS.length)] as DriverLabel,
      eventCount: Math.floor(Math.random() * 50) + 1,
    }))
    .sort((a, b) => b.score - a.score)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  return {
    computedAt: new Date().toISOString(),
    window,
    rows,
  };
}

export function generateMockMovers(window: WindowType): MoversResponse {
  const movers = REAL_ENTITIES.slice(0, 15).map((entity) => ({
    entityId: entity.id,
    name: entity.name,
    type: entity.type,
    momentum: randomMomentum(),
    microMomentum: Math.random() * 100,
    driver: DRIVERS[Math.floor(Math.random() * DRIVERS.length)] as DriverLabel,
    sources: randomSources(),
    receiptCount: Math.floor(Math.random() * 30) + 1,
  }));

  // Sort by absolute momentum
  movers.sort((a, b) => Math.abs(b.momentum) - Math.abs(a.momentum));

  return {
    computedAt: new Date().toISOString(),
    window,
    movers,
  };
}

export function generateMockFeed(window: WindowType): FeedResponse {
  const cards = Array.from({ length: 20 }, (_, i) => ({
    id: `card-${i}`,
    source: (['youtube', 'reddit'] as const)[Math.floor(Math.random() * 2)],
    title: `${i % 2 === 0 ? 'Clip' : 'Thread'} About ${
      REAL_ENTITIES[Math.floor(Math.random() * REAL_ENTITIES.length)].name
    }`,
    meta: {
      author: `User${Math.floor(Math.random() * 100)}`,
      channel: `Channel${Math.floor(Math.random() * 20)}`,
      timestamp: new Date(Date.now() - Math.random() * 3600000 * 6).toISOString(),
      platform: (['youtube', 'reddit'] as const)[Math.floor(Math.random() * 2)],
    },
    why: `This ${i % 2 === 0 ? 'clip' : 'thread'} sparked ${
      Math.floor(Math.random() * 500) + 100
    } reactions across platforms`,
    url: `https://example.com/mock-${i}`,
    eventId: `event-${i}`,
    entityIds: [REAL_ENTITIES[Math.floor(Math.random() * REAL_ENTITIES.length)].id],
  }));

  return {
    computedAt: new Date().toISOString(),
    window,
    cards,
  };
}
