# Problem: Cocoon-breaking exploration explanation lacks transparency

When an article is surfaced by the cocoon-breaking (exploration) algorithm, the frontend shows the generic reason: *"本文由破茧算法打捞，你可在设置页调整算法信息茧房水平"* along with the score component `探索加分: 0.0467`. But the user cannot understand **why this particular article** was selected:

1. **Pre-exploration rank**: Where was the article before being lifted? The diversity penalty (-0.0941 in the case study) is visible, but the user doesn't know this means the article fell out of the top 20 after MMR reranking.
2. **Exploration bucket**: Was the article eligible via `pending_embedding` (≤72h, embedding not ready) or `feed` (no behavior events, ≤48h)?
3. **Exploration reason**: The backend `explorationEligibilityFor()` returns a specific reason string, but it's not displayed.
4. **Eligibility conditions**: Which criteria qualified this article for exploration? (e.g., zero behavior events + young article)
5. **Seed score**: The deterministic hash (`explorationSeedScore()`) determines which eligible candidate fills the slot, but this is invisible to the user.

The backend `explanationPayloadFor()` already includes `explorationBucket` and `explorationReason` in its response when `wasExploration` is true, but the frontend rendering code doesn't use them.
