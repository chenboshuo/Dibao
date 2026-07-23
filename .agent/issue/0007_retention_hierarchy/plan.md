# Plan: Implementation phases

## Phase 1 — Feed Tier column
- Add `retentionTier` column to `feeds` table (text, `"default" | "flash" | "normal" | "deep"`, nullable, null = default)
- Feed folders optionally inherit or set a default for children
- Expose via API, add Settings UI controls

## Phase 2 — Score-aware cleanup
- Extend `listRetentionCandidates` WHERE clause with optional score-based filters
  Example: `interestScore < -2.0 AND age > 7days` → clean even if tier deadline hasn't been hit
- Include `rank_scores` and `behavior_events` in cleanup scope

## Phase 3 — Smart degradation
- Use `penaltyScore`, `explorationBonus`, and `stateScore` as retention weights
- Compute a "retention score" per article — articles below threshold are cleaned first regardless of age
- The scheduler processes in order of retention score (ascending), not just by age
