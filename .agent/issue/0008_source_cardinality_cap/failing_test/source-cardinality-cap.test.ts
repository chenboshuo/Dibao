/**
 * Issue 0008: Per-source cardinality cap
 *
 * Expected:
 * 1. A new `sourceCap` setting per-source (in addition to the global sourceCap
 *    from cocoonParameters) limits how many articles a single source can retain
 * 2. When cap is exceeded, articles with the lowest rank scores are evicted first
 * 3. Protected articles (favorites, read-later) are excluded from eviction
 *    but count toward the cap
 * 4. Eviction happens at insert time (new article fetched → evict lowest-scored)
 * 5. Works alongside retentionDays — whichever eviction condition is met first wins
 *
 * Current: No per-source cardinality cap exists. Only global time-based retention.
 */
import { describe, expect, it } from "vitest";

describe("0008: Per-source cardinality cap", () => {
  it("should have a sourceCap setting on source-level settings", () => {
    // Expected: Source settings schema has `sourceCap: number | null`
    // (null = unlimited). Default is null.
    expect(false, [
      "sourceCap per-source setting not implemented.",
      "Expected: a sourceCap field on source-level settings that defaults to null.",
      "See 0008 issue for full requirement and plan."
    ].join(" ")).toBe(true);
  });

  it("should evict lowest-scored articles when source exceeds cap on insert", () => {
    // Expected: ArticleRetentionService.enforceSourceCap(sourceId) is called
    // after each new article insert. It checks if the source's article count
    // exceeds sourceCap, and if so, deletes the lowest-scored articles.
    //
    // Eviction criteria: composite = interestScore + freshnessScore - penaltyScore
    // Protected (favorites, read-later) excluded from eviction.
    expect(false, [
      "enforceSourceCap not implemented.",
      "Expected: ArticleRetentionService.enforceSourceCap() that evicts",
      "lowest-scored articles when a source exceeds its cardinality cap."
    ].join(" ")).toBe(true);
  });

  it("should preserve protected articles during source cap eviction", () => {
    // Expected: Favorited and read-later articles are not deleted even if
    // the source exceeds its cap. They count toward the cap but are excluded
    // from eviction candidates.
    expect(false, [
      "Protected article exclusion not implemented.",
      "Expected: enforceSourceCap skips favorites and read-later articles",
      "when selecting eviction candidates."
    ].join(" ")).toBe(true);
  });

  it("should work alongside retentionDays — both constraints apply independently", () => {
    // Expected: sourceCap and retentionDays are independent constraints.
    // Whichever threshold is met first triggers its eviction logic.
    expect(false, [
      "sourceCap + retentionDays interaction not implemented.",
      "Expected: both constraints work independently without double-deletion."
    ].join(" ")).toBe(true);
  });

  it("should not evict when sourceCap is null or 0", () => {
    // Expected: sourceCap=null or sourceCap=0 means unlimited — no eviction
    // regardless of insert volume.
    expect(false, [
      "Unlimited sourceCap (null/0) not handled.",
      "Expected: enforceSourceCap is a no-op when cap is null/0."
    ].join(" ")).toBe(true);
  });
});
