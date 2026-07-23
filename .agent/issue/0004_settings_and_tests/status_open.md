# Status

Open — 2026-06-16

## Completed work (2026-06-18)

All 7 files for settings infrastructure are implemented. See `plan.md` for details.

## Observations (2026-06-17)

### 1. Breakdown score rank label is wrong — ranks from total, not per-channel

`rankPosition` and `rankTotal` reflect the full MMR window (~500 candidates), not the paginated response (25 articles). The UI says "top 20%" based on 5/25, but the real context is "NO.5 out of 500".

**Root cause**: `explanationPayloadFor` sets these from `rerankCanonicalWindow`'s output position and the `reranked.length`.

**Fix**: Changed from `"NO.5, top 20%"` to `"#5 in ranking pool of 500"`.

### 2. Diversity penalty always red in breakdown table

`color: raw >= 0 ? "var(--color-ink)" : "var(--color-danger)"` renders diversityPenalty red even for normal adjustments like -0.0001.

**Fix**: Penalty components now use `var(--color-ink)` unless < -0.01 threshold, then `var(--color-warning)`.

### 3. Need inline toggle for breakdown + explanation text in settings

`showScoreComponents` setting exists but is buried. The explanation panel should have its own local toggle.

**Fix**: Removed server-side `showScoreComponents` gate — `components` always emitted in API response. The native `<details>`/`<summary>` provides per-article local toggle.

### 4. Source hard cap resets on pagination

`sourceCounts` is local per `rerankCanonicalWindow` call; cursor-based pages restart the counter. Inherent to stateless scoring design.
