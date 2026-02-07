# 💬 Chatters & ✂️ Clippers - Ranking Guide

## What Are These Categories?

### 💬 Most Influential Chatters
**Definition:** Active community members who drive conversation and engagement through:
- High-quality comments and discussion starters
- Receipts compilation and fact-checking
- Viral takes and reactions
- Community moderation and curation

**Scoring Metrics:**
- Comment velocity (Reddit/YouTube)
- Reply depth (how many replies their comments get)
- Upvote/like ratios on comments
- Thread creation impact
- Cross-platform mention frequency

**Data Sources:**
- Reddit comment authors with high engagement
- YouTube comment authors with high likes
- X/Twitter reply thread starters

### ✂️ Top Clippers
**Definition:** Content creators who create viral clip compilations:
- YouTube channels that post highlight clips
- TikTok/Short-form content creators
- Reaction clip editors
- Timestamp heroes

**Scoring Metrics:**
- Clip view velocity
- Clip share velocity
- Original vs derivative content ratio
- Clip distribution (how many places it spreads)
- Channel subscriber growth rate

**Data Sources:**
- YouTube "clipper" channels (short-form highlight content)
- Channels with high clip-to-full-show ratio
- Accounts that primarily post edited segments

## How to Identify & Add Them

### Finding Chatters

1. **Look at Reddit threads** in your target subreddits
   - Who posts receipts threads?
   - Who consistently gets 50+ upvotes?
   - Who drives drama discussion?

2. **Check YouTube comment sections**
   - Who has pinned comments?
   - Who gets hearted by creators?
   - Who gets 500+ likes on comments?

3. **Monitor X/Twitter replies**
   - Who quote-tweets with viral takes?
   - Who posts the best dunks?

### Finding Clippers

1. **YouTube search** your main shows/characters
   - Filter by upload date (recent)
   - Look for 2-10 minute clips (not full episodes)
   - Check channel names with "Clips", "Highlights", "Moments"

2. **Check video descriptions**
   - Clippers often credit original source
   - Look for "via @originalshow"

3. **Track viral clips**
   - When a clip goes viral, note who uploaded it
   - Track channels that consistently produce viral clips

## Seed Data Format

### Adding a Chatter

```json
{
  "id": "chatter-username-123",
  "type": "chatter",
  "canonical_name": "RedditUser123",
  "description": "Receipts compiler, active in r/dabbleverse",
  "enabled": true
}
```

**Aliases for chatters:**
```json
{
  "entity_id": "chatter-username-123",
  "alias_text": "u/reddituser123",
  "match_type": "handle",
  "platform_scope": "reddit",
  "confidence_weight": 1.0
},
{
  "entity_id": "chatter-username-123",
  "alias_text": "@RedditUser123",
  "match_type": "handle",
  "platform_scope": "x",
  "confidence_weight": 0.9
}
```

### Adding a Clipper

```json
{
  "id": "clipper-channelname",
  "type": "clipper",
  "canonical_name": "DabbleClips Channel",
  "description": "High-quality clip compilations",
  "enabled": true
}
```

**Aliases for clippers:**
```json
{
  "entity_id": "clipper-channelname",
  "alias_text": "dabbleclips",
  "match_type": "exact",
  "platform_scope": "youtube",
  "confidence_weight": 1.0
},
{
  "entity_id": "clipper-channelname",
  "alias_text": "@dabbleclips",
  "match_type": "handle",
  "platform_scope": "x",
  "confidence_weight": 1.0
}
```

## Scoring Logic Differences

### Chatters
- **Weight comments over posts** (quality over quantity)
- **Measure reply depth** (how much discussion they spark)
- **Track receipts threads** (documented proof posts)
- **Bonus for cross-platform presence** (same user on Reddit + X)

### Clippers
- **Weight view velocity** over raw views
- **Measure clip distribution** (reposted/shared)
- **Track upload frequency** (consistent clippers get boost)
- **Bonus for original timestamp discovery** (first to clip a moment)

## Example Top Chatters

Based on Reddit/YouTube engagement patterns:
- u/ReceiptsGuy - Compiles contradictions
- u/TimestampHero - Timestamps everything
- u/DramaSummaryBot - Summarizes feuds
- @DabbleTakes - Viral quote tweets

## Example Top Clippers

Based on YouTube clip channels:
- "Dabble Clips Official"
- "Best of Stuttering John"
- "Hackverse Highlights"
- "Quick Clips Network"

## Anti-Patterns (Do NOT Add)

❌ **Don't add as chatters:**
- Spam accounts
- Bot accounts
- One-hit wonders (single viral comment)
- Trolls without substance

❌ **Don't add as clippers:**
- Full episode re-uploaders (not clippers)
- Reaction channels (they're characters, not clippers)
- Channels with < 5 clips total
- Copyright violators who get DMCA'd constantly

## Iteration Strategy

### Week 1: Manual Curation
- Add 10-20 obvious top chatters
- Add 10-15 known clipper channels
- Test matching works correctly

### Week 2: Monitor Rankings
- See who actually ranks high
- Add missing influential accounts
- Adjust confidence weights if needed

### Week 3: Expand Coverage
- Add medium-tier chatters/clippers
- Build out 50+ entities per category
- Set up auto-discovery for new accounts

## Database Query Examples

### Top Chatters by Momentum

```sql
SELECT e.canonical_name, s.score, s.momentum
FROM scores s
JOIN entities e ON s.entity_id = e.id
WHERE e.type = 'chatter' AND s.window = 'now'
ORDER BY s.momentum DESC
LIMIT 10;
```

### Top Clippers by Score

```sql
SELECT e.canonical_name, s.score, s.event_count
FROM scores s
JOIN entities e ON s.entity_id = e.id
WHERE e.type = 'clipper' AND s.window = '24h'
ORDER BY s.score DESC
LIMIT 10;
```

## UI Display

Both categories now display in the dashboard:

**Desktop:** 2-column grid below the main 3-column section  
**Mobile:** Stacked cards, full width

Each shows:
- Icon (💬 for chatters, ✂️ for clippers)
- Rank (1-10)
- Name
- Score
- Momentum %

---

**Questions? Check seed/IMPORT_INSTRUCTIONS.md for general seed data workflow.**
