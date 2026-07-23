# Status

Closed — 2026-06-16

## Fix (committed on `personal_settings`)

In `rerankCanonicalWindow` (`ranking-service.ts`):

1. **Replace linear sourcePenalty with hard skip** — instead of `sourcePenalty = sourceCount >= sourceCap ? 0.12 * diversityStrength : sourceCount * 0.01`, the loop now does `continue` when `sourceCount >= sourceCap`.
2. **No adjacency** — `continue` when `lastFeedId === item.candidate.feedId`.
3. **`bestScore === -Infinity` guard** — break the selection loop when all remaining candidates were skipped (prevented a bug where blocked items were still selected via `splice(0,1)`).
4. **Today-read count label** — "今日已读第N篇" shown on recommendation cards, counting user's `last_opened_at`/`read_at` in the past 24h per feed.
