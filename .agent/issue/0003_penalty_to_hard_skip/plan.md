# Plan: Replace linear sourcePenalty with hard continue

## Fix (already committed)

In `rerankCanonicalWindow` (`ranking-service.ts`), the `sourcePenalty` was **removed** and replaced with hard `continue`:

```diff
- const sourceCount = sourceCounts.get(item.candidate.feedId) ?? 0;
- const sourcePenalty =
-   sourceCount >= params.sourceCap ? 0.12 * params.diversityStrength : sourceCount * 0.01;
+ const sourceCount = sourceCounts.get(item.candidate.feedId) ?? 0;
+ if (sourceCount >= params.sourceCap) {
+   continue;
+ }
```

### Supporting changes

1. **Adjacency blocking** — `if (lastFeedId !== null && item.candidate.feedId === lastFeedId) continue;` prevents consecutive same-feed articles.
2. **`bestScore === -Infinity` guard** — if every remaining candidate was skipped by a hard rule, break the selection loop instead of picking the wrongly-skipped first item.

## Related

- Parent: [0001](../0001_source_diversity/)
- Settings & tests follow-up: [0004](../0004_settings_and_tests/)
