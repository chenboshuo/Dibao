# Problem: Static scoring components are stored and recalculated instead of derived via SQL views

## Summary

Freshness, source quality, and user state scores are deterministic SQL expressions (JOIN + formula) but are stored in `article_rank_scores` and recomputed on every recalc cycle — no SQL views exist to derive them cheaply.

## Evidence

**No views exist.** Grep across all 25 migrations in `packages/db/migrations/` shows zero `CREATE VIEW` statements. The `article_rank_scores` table at `packages/db/migrations/001_initial_schema.sql:265` is the single source of truth for all score components.

**Three score components are pure SQL expressions:**

1. **freshnessScore** (`packages/ranking/src/index.ts:135`):
   ```sql
   exp(-(now - coalesce(published_at, discovered_at)) / 129600000) * 0.18
   ```
   → depends only on `articles.published_at` / `articles.discovered_at`

2. **sourceScore** (`packages/ranking/src/index.ts:257`, `normalizedSourceScore` at :1683):
   ```sql
   clamp(source_weight, -1, 1) * 0.08 + feed_stats.smoothed_positive_rate * ...
   ```
   → depends on `feeds.source_weight` + `feed_stats.*`

3. **stateScore** (`packages/ranking/src/index.ts:275`, `stateScoreForV2` at :1706):
   ```sql
   case when read_at is null then 0.04 else -0.06 end +
   case when read_later_at is not null then 0.08 else 0 end + ...
   ```
   → depends on `article_states.*`

**These are recomputed in every `writeScores()` call** (`ranking-service.ts:467-490`), which means:
- Every user action → job pipeline → full recalc recalculates these trivial expressions
- The stored values in `article_rank_scores` can get stale if a user action updates `article_states` but ranking hasn't run yet
- Freshness decays continuously, but the stored value is pinned to whatever time the last recalc ran

## Impact

- Unnecessary compute: static formulas recomputed on every ranking cycle
- Staleness: if `article_states` changes (user marks read), the stored score doesn't reflect it until next recalc
- Maintenance burden: jobs like `recommendation_backfill` exist just to resync these cached values
- The `article_rank_scores` table (~10 columns of derived data) acts as a materialized cache with no invalidation logic

## Expected

A SQL view `article_static_scores` that derives freshness, source, and state scores via JOIN + expression. The ranking service can read from this view instead of recalculating these components. Only the truly dynamic components (semantic matching, FTRL, diversity rerank) remain in procedural code.

## Context

- `packages/ranking/src/index.ts:215-285` — `calculateSourceScore()`, `calculateStateScore()`
- `apps/server/src/ranking-service.ts:257-295` — source/state functions for V2 scoring
- `packages/db/migrations/001_initial_schema.sql` — relevant tables: `articles`, `feeds`, `feed_stats`, `article_states`, `article_rank_scores`
- `packages/db/src/repositories/articles.ts:1254-1312` — `baseArticleReadSelect()` — existing complex LEFT JOIN that could be extended
