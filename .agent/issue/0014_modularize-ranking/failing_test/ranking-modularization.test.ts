/**
 * Issue 0014: Ranking service monolith mixes static and dynamic scoring
 *
 * Expected:
 * 1. StaticScoreService exists as a separate module, reads from
 *    article_static_scores view and produces baseScore quickly
 * 2. DynamicScoreService exists as a separate module, takes baseScore +
 *    article features + profile state, produces V2Score with semantic
 *    matching, BM25, FTRL, and MMR reranking
 * 3. writeScores() becomes a lightweight coordinator calling
 *    staticScore() then dynamicScore()
 * 4. Each module can be independently tested
 *
 * Current: writeScores() (~300 lines) does everything in one monolithic
 * loop. Static and dynamic components interleave data dependencies.
 */
import { describe, expect, it } from "vitest";

describe("0014: Ranking service modularization", () => {
  it("should have a separate StaticScoreService module", () => {
    // Expected: A StaticScoreService class/module exists that computes
    // static score components (freshness, source, state) independently
    // from the dynamic ranking pipeline.
    //
    // Current: All scoring is in RecommendationRankingService.writeScores()
    // (~300 lines in ranking-service.ts:327). No StaticScoreService exists.
    expect(false, [
      "StaticScoreService module not found.",
      "Expected: a separate StaticScoreService that computes baseScore",
      "from static signals. Currently all in writeScores() monolith."
    ].join(" ")).toBe(true);
  });

  it("should have a separate DynamicScoreService module", () => {
    // Expected: A DynamicScoreService exists that handles semantic matching,
    // BM25, FTRL, and MMR reranking. It takes baseScore as input and
    // produces V2Score.
    expect(false, [
      "DynamicScoreService module not found.",
      "Expected: a separate DynamicScoreService for interest-based scoring.",
      "Currently interleaved with static scoring in writeScores()."
    ].join(" ")).toBe(true);
  });

  it("should be able to test static scoring without full pipeline setup", () => {
    // Expected: Static score tests only need a SQLite DB with articles,
    // feeds, and feed_stats. No clusters, FTRL, or embeddings required.
    //
    // Current: profile-ranking.test.ts requires the full pipeline setup
    // (SQLite DB, embeddings, profile clusters, FTRL model, etc.)
    // even for testing static score changes.
    expect(false, [
      "Static scoring cannot be tested without full pipeline.",
      "Expected: StaticScoreService is independently testable with",
      "minimal setup (articles + feeds only)."
    ].join(" ")).toBe(true);
  });
});
