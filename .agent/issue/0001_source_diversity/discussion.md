# Discussion

## Q: Should favorited / readLater articles be exempted?

**A (Decided):** No. Even liked feeds should respect the cap. Raise cocoonLevel to increase sourceCap if a feed is genuinely that valuable.

## Q: Is source preference computed by absolute quantity or by ratio?

**A:** Absolute counts (`feedPositiveScore - feedNegativeScore`), not ratios. A Bayesian-smoothed ratio approach was discussed but deferred to [0004](../0004_settings_and_tests/) as the `sourceScoringMode` toggle.
