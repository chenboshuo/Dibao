# Requirement

## Problem

The current retention system only considers **time** (retentionDays) as an eviction signal, but for high-volume sources (news alerts, Twitter-like updates, aggregator feeds), it is more intuitive to limit **how many articles** are kept per source. Without a cardinality cap:

- A single prolific source can dominate the database, even with short retentionDays.
- The user has no way to say "keep only the latest/relevant N articles from this source."
- Ranking scores (interestScore, penaltyScore, freshnessScore) are computed but never used to decide what to evict — a low-score article and a high-score article from the same source live equally long.

## Target

Add a **per-source cardinality cap** (`sourceCap`) that limits how many articles a single source can retain. When the cap is exceeded, articles with the lowest rank scores are evicted first. This gives users a cardinality-based eviction model alongside the existing time-based model.

### Design details

- **Setting location**: Per-source in the user's personal settings (same `settings` table / `settings-service.ts` pattern used by sourceScoringMode, sourceCapOverride, etc.)
- **Setting field**: `sourceCap: number` — max articles to keep per source (0 or null = unlimited, backward compatible)
- **Eviction policy**: When a source exceeds `sourceCap`, articles are evicted in order of **composite rank score** ascending (lowest score first)
  - Composite rank score = `interestScore + freshnessScore - penaltyScore` (or similar weighted formula)
  - Protected articles (favorites, read-later) are excluded from eviction but **count toward the cap** — if a source has 50 articles, 10 protected, and cap is 50, the lowest-scored unprotected article gets evicted past 50
- **Eviction trigger**: On new article arrival (insertion-time eviction) — when a new article is fetched for a source that's at capacity, evict the lowest-scored article immediately. This keeps the DB lean in real time rather than waiting for the periodic cleanup job.
- **Interaction with retentionDays**: A source can have both `retentionDays` (from issue 0007 tiers) and `sourceCap`. Both apply — whichever eviction condition is met first triggers cleanup. The more aggressive constraint wins.

### Non-goals (out of scope)

- Feed-folder-level caps (only per-source for now)
- User-level aggregate cap ("keep at most 10000 articles total")
- Grouping/duplicate-based eviction (two similar articles from the same source)

## Context

- Related retention code: `apps/server/src/article-retention-service.ts`, `apps/server/src/retention-cleanup-job-service.ts`, `packages/db/src/repositories/articles.ts`
- Related settings pattern: `apps/server/src/settings-service.ts`, `apps/server/src/ranking-service.ts` (sourceScoringMode, sourceCapOverride)
- Issue 0007 introduces retention tiers (time-based); this issue complements it with cardinality-based eviction
- Ranking scores table: `rank_scores` — the composite score derivation should use existing columns
