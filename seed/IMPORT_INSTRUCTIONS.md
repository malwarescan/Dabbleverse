# 🚀 How to Import Real Entity Data

## Files Created

1. **`seed/entities/REAL_ENTITIES.json`** - 57 real characters with clean canonical names
2. **`seed/entities/REAL_ALIASES.json`** - Aliases and alternate names for matching

## Import Steps

### Option 1: Replace Existing Seed Data

```bash
# Backup current seed files
cp seed/entities/entities.json seed/entities/entities.json.backup
cp seed/entities/aliases.json seed/entities/aliases.json.backup

# Copy real data over
cp seed/entities/REAL_ENTITIES.json seed/entities/entities.json
cp seed/entities/REAL_ALIASES.json seed/entities/aliases.json

# Run seed script
npm run seed
```

### Option 2: Merge with Existing Data

Open `seed/entities/REAL_ENTITIES.json` and `seed/entities/REAL_ALIASES.json`, then copy the entities/aliases arrays into your existing `entities.json` and `aliases.json` files.

## Entity Naming Convention

### Canonical Names (Clean)
- **Stuttering John Melendez** (not "Stuttering John (John Melendez)")
- **Steel Toe** (not "Steel Toe (Aaron Imholte)")
- **Vic** (not "Vic (Vince the Lawyer / Vince)")

### Aliases (For Matching)
Parenthetical text and alternate names are stored as separate aliases:
- "Steel Toe" → aliases: ["steel toe", "aaron imholte"]
- "Vic" → aliases: ["vic", "vince the lawyer", "vince"]
- "Bob Levy" → aliases: ["bob levy", "fat bob"]

## Deduplication Notes

✅ **Fixed duplicates:**
- Anthony Cumia (was listed twice)
- Bob Levy / Fat Bob (merged into one entity with alias)

✅ **ID Format:**
- Pattern: `char-{lowercase-name-with-dashes}`
- Example: `char-stuttering-john`, `char-lady-k`

## Match Types Explained

- **`exact`** - Must match exactly (case-insensitive)
- **`contains`** - Text contains this phrase
- **`regex`** - Pattern matching (use sparingly)
- **`handle`** - Social media handle (@username)

## Confidence Weights

- **1.0** - Primary name, very confident
- **0.95** - Well-known nickname (Fat Bob, Nylo)
- **0.85-0.9** - Common shorthand (Shuli, Cardiff)
- **0.7-0.8** - Could be ambiguous (SJ, Karl, Vince)

## Next Steps

1. **Add more aliases** - As you discover common misspellings, nicknames, etc.
2. **Add descriptions** - Fill in the `description` field for key characters
3. **Add chatters/clippers** - Create similar files for `REAL_CHATTERS.json` and `REAL_CLIPPERS.json`
4. **Test matching** - Build alias test endpoint to verify matches work correctly

## Testing Alias Matching

After seeding, you can test if text matches entities:

```bash
# Example test queries
"stuttering john mentioned"     → matches char-stuttering-john
"fat bob appeared"               → matches char-bob-levy  
"vince the lawyer called in"    → matches char-vic
"steel toe aaron imholte"       → matches char-steel-toe
```

## Database Command

If you need to regenerate the database:

```bash
# Push schema (creates tables)
npm run db:push

# Seed data
npm run seed
```

## Notes for Future

- Keep canonical names **clean and professional**
- Store ALL alternate names as **aliases**
- Use **confidence weights** to handle ambiguous matches
- **Platform scope** lets you match "@stutjo" only on X/Twitter
- Add new characters to REAL_ENTITIES.json as the community grows

---

**Created:** 2026-02-07  
**Total Characters:** 57  
**Total Aliases:** ~40 (expand as needed)
