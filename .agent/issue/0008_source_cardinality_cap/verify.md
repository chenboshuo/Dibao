# Verify: Per-source cardinality cap

## Preconditions

- The project builds and tests pass before starting
- A source with at least 20 articles exists in the test database
- The test source has rank_scores populated for its articles

## Steps

1. **Unit test: sourceCap setting is stored and retrieved**
   - Set `sourceCap` to 50 for a known source via `settings-service.ts`
   - Read it back and assert equal

2. **Unit test: eviction on insert when at capacity**
   - Set `sourceCap=3` for a source that has 3 articles
   - Insert a 4th article via the ingestion pipeline
   - Assert the source has exactly 3 articles
   - Assert the evicted article is the one with the lowest composite rank score (not necessarily the oldest)
   - Assert protected articles (favorites/read-later) are not evicted

3. **Unit test: composite rank score ordering**
   - For a source with 5 articles with known rank scores, verify the eviction candidate ordering matches composite score ascending

4. **Integration test: sourceCap + retentionDays interaction**
   - Set both `sourceCap=10` and `retentionDays=7` on a source
   - Verify whichever threshold is met first triggers its eviction

5. **Regression test: sourceCap=0 (unlimited)**
   - Set `sourceCap=0` or `null`
   - Insert 100 articles — none should be evicted by cardinality logic

## Expected Result

- All tests pass
- sourceCap correctly limits per-source article count
- Lowest-ranked articles are evicted first
- Protected articles survive eviction

## Commands

```bash
cd apps/server
npm test -- --testPathPattern="source-cardinality|retention"
```
