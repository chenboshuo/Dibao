# Problem: Ranking service monolith mixes static and dynamic scoring in one `writeScores()` method

## Summary

`RecommendationRankingService.writeScores()` (~300 lines in `ranking-service.ts:327`) computes all score components — cheap static ones and expensive dynamic ones — in one monolithic loop with no modular boundary.

## Evidence

**The `writeScores()` method** (`apps/server/src/ranking-service.ts:327`) does everything in one pass:

1. Lists candidates (SQL query)
2. Loads clusters & recent intent vectors (in-memory)
3. Computes lexical/duplicate/source features (SQL + JS)
4. **For each candidate:**
   - `calculateBaselineRankScore()` — freshness + source + state + interest + penalty (cheap)
   - `calculateV2Score()` — semantic matching + BM25 + FTRL + normalized source + duplicate penalty + etc. (expensive)
5. Reranks via MMR (iterative algorithm)
6. Writes all scores + explanations to DB

**Key problem: the cheap and expensive parts interleave data dependencies.**

```typescript
// ranking-service.ts:467-516
for (const candidate of candidates) {
  const baseScore = calculateBaselineRankScore({ ... });   // cheap, should be view
  // ...
  const score = calculateV2Score({                         // expensive, interest-based
    candidate, now, clusters, recentIntent, settings,
    baseScore: baseScore.score,                            // depends on baseScore
    // ...
  });
}
```

The `baseScore` is used as input to `V2Score`, so they can't simply be two separate queries — but the static components (freshness, source, state) inside `baseScore` don't need to be *computed* here, they should be *read from a view*.

**No separation of concerns means:**
- Adding a new static signal requires understanding the entire ranking pipeline
- Adding a new dynamic model (e.g., a new interest-matching algorithm) risks breaking static scoring
- Testing requires the full pipeline setup (clusters, FTRL, embeddings, etc.) even for static-score changes
- A future Python scoring service has no clean extraction boundary — everything interleaves

## Impact

- High cognitive load for new contributors
- Changes to static scoring are tested via integration tests that also exercise the complex dynamic pipeline
- Cannot independently scale or deploy dynamic scoring
- Adding ML features (PyTorch, sklearn) requires untangling the monolith first

## Expected

The ranking service is split into two modules with a clean interface:

- **StaticScoreService** — reads from `article_static_scores` view, produces `baseScore` component quickly
- **DynamicScoreService** — takes `baseScore` + article features + profile state, produces `V2Score` with semantic matching, BM25, FTRL, and MMR reranking

`writeScores()` becomes a lightweight coordinator calling `staticScore()` then `dynamicScore()`. Each module can be independently tested, modified, and — in the future — deployed separately.

## Context

- `apps/server/src/ranking-service.ts` — the monolithic service (2346 lines total)
- `apps/server/src/ranking-service.ts:327-613` — `writeScores()` method
- `apps/server/src/ranking-service.ts:1539-1681` — `calculateV2Score()` — the expensive per-candidate function
- `packages/ranking/src/index.ts:143-171` — `calculateBaselineRankScore()` — cheap static score
