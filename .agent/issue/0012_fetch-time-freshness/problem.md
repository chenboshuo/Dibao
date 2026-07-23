# Problem: Freshness score not assigned at article ingestion time

## Summary

Feed refresh inserts articles without computing any score, so new articles have no sort/rank signal until the full job pipeline runs.

## Evidence

**`FeedRefreshService.writeParsedFeed()`** at `apps/server/src/feed-refresh-service.ts:154` upserts articles and content, but never writes a score to the database.

```typescript
// No score write happens here — just upsert + content
const article = this.options.articles.upsert(articleInput);
this.options.articles.upsertContent({ articleId: article.id, ... });
```

**Freshness is a pure function of `published_at`** (`packages/ranking/src/index.ts:135`):
```typescript
export function freshnessScore(ageHours: number, maxScore = 0.18, halfLifeHours = 36) {
  return Math.exp(-ageHours / halfLifeHours) * maxScore;
}
```

This depends only on `(now - publishedAt)`, no user context needed — can be computed at insert time.

**Freshness isn't computed until `ranking_recalculate`** (`ranking-service.ts:467`):
```typescript
const baseScore = calculateBaselineRankScore({
  now,
  publishedAt: candidate.publishedAt,
  discoveredAt: candidate.discoveredAt,
  // ... 15 other fields
});
```

The `freshnessScore` is embedded inside this monolithic call — it's computed many minutes/hours after ingestion, so the score is already stale on first write.

## Impact

- Fresh articles have `score = 0` until the job pipeline reaches them
- The "latest" view/feed is unranked for new articles — they rely on `published_at` sort only
- The ranking job recomputes freshness for every article on every cycle, even though freshness is deterministic from `published_at`

## Expected

When a feed is refreshed, each article gets a `freshness_score` stored on the `articles` table at insert time. The "latest" view and any SQL query can immediately sort by this score. The `ranking_recalculate` job can skip freshness recomputation and read from the stored value.

## Context

- `apps/server/src/feed-refresh-service.ts` — ingestion point
- `packages/ranking/src/index.ts:135-141` — `freshnessScore()` function
- `apps/server/src/ranking-service.ts:467-490` — where freshness is currently computed in the monolithic loop
- `packages/db/migrations/001_initial_schema.sql:69-86` — current `articles` table schema (no freshness column)
