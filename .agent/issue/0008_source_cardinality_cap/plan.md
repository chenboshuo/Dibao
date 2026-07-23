# Plan: Per-source cardinality cap

## Phase 1: Settings layer — `sourceCap` on source-level settings

- [ ] Add `sourceCap: number | null` to the source settings schema in `settings-service.ts`
  - [ ] Default: `null` (unlimited)
  - [ ] Validate: must be >= 0 integer, null allowed
  - [ ] Add to `SourceSettings` type / Zod schema
- [ ] Add `sourceCap` to the Settings UI (`apps/web/src/`)
  - [ ] Add a number input in the source detail panel
  - [ ] Label: "Max articles to keep" / "文章上限"
  - [ ] Placeholder: "无限制" (unlimited)
  - [ ] Wire to `api.ts` settings update endpoint
- [ ] Write unit tests for setting persistence and validation

## Phase 2: Eviction core — insert-time cardinality enforcement

- [ ] In `article-retention-service.ts`, implement `enforceSourceCap(sourceId: string)`
  - [ ] Query article count for the source from `articles` table
  - [ ] If count > sourceCap, select candidates to evict:
    - [ ] Join `rank_scores` to get `interestScore`, `freshnessScore`, `penaltyScore`
    - [ ] Compute composite score: `interestScore + freshnessScore - penaltyScore`
    - [ ] Exclude protected articles (favorites, read-later) from eviction
    - [ ] ORDER BY composite_score ASC LIMIT (count - sourceCap)
  - [ ] Delete selected articles (cascade to events, scores)
- [ ] Wire into the ingestion pipeline — call `enforceSourceCap` after each new article is inserted
  - [ ] Locate the ingestion entry point (`feed-fetch-job` or similar)
  - [ ] After successful insert, check if source has a cap set; if so, call the function
- [ ] Handle batch fetch: when fetching N new articles for a source, evict only after all inserts are complete (don't re-check after each single insert)

## Phase 3: Interaction with existing retention + testing

- [ ] Ensure `enforceSourceCap` is independent from and compatible with the periodic retention cleanup job (issue 0007)
  - [ ] Both can run independently — sourceCap at insert time, retentionDays at schedule time
  - [ ] No double-deletion or conflict
- [ ] Write integration tests:
  - [ ] sourceCap=3, insert 4th article → 3 remain, lowest-score evicted
  - [ ] sourceCap=null → no eviction regardless of insert volume
  - [ ] sourceCap=5, 2 are favorites, 8 non-favorites → after inserting 1 more, only 1 non-favorite evicted (favorites stay)
  - [ ] sourceCap=5 + retentionDays=7 → both constraints work independently
- [ ] Write a DB migration to add `sourceCap` column if needed (or confirm settings table already supports arbitrary per-source keys)
