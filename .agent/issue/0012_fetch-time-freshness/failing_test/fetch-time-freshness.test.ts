/**
 * Issue 0012: Freshness score not assigned at article ingestion time
 *
 * Expected:
 * 1. The `articles` table has a `freshness_score` column
 * 2. FeedRefreshService.writeParsedFeed() computes and stores freshnessScore
 *    at insert time using freshnessScore(published_at, halfLifeHours=36)
 * 3. The "latest" view and any SQL query can immediately sort by this score
 * 4. The ranking_recalculate job reads stored freshness instead of recomputing
 *
 * Current: No freshness_score column on articles table. Freshness is only
 * computed inside the monolithic calculateBaselineRankScore() during ranking
 * recalc. New articles have score=0 until the job pipeline reaches them.
 */
import { describe, expect, it } from "vitest";

describe("0012: Fetch-time freshness score", () => {
  it("should have freshness_score column on articles table", () => {
    // Expected: The articles table has a `freshness_score REAL` column
    // that stores the freshness score computed at insert time.
    //
    // Current: The articles table schema (migrations/001_initial_schema.sql:69-86)
    // has no freshness_score column. Freshness is computed on-the-fly in
    // calculateBaselineRankScore() during ranking recalc.
    expect(false, [
      "freshness_score column not found on articles table.",
      "Expected: freshness_score REAL DEFAULT 0.0 column added via migration.",
      "See packages/db/migrations/ for the current schema."
    ].join(" ")).toBe(true);
  });

  it("should compute and store freshness score at article insertion time", () => {
    // Expected: FeedRefreshService.writeParsedFeed() computes
    // freshnessScore(publishedAt, halfLifeHours=36) for each article
    // and stores it in the freshness_score column.
    //
    // Current: writeParsedFeed() (feed-refresh-service.ts:154) only does
    // upsert + content — no score computation.
    expect(false, [
      "Freshness score not computed at ingestion time.",
      "Expected: FeedRefreshService.writeParsedFeed() stores freshness_score",
      "on each article at insert time."
    ].join(" ")).toBe(true);
  });

  it("should rank 'latest' view by stored freshness score", () => {
    // Expected: The "latest" articles query uses the stored freshness_score
    // for sorting, not just published_at.
    expect(false, [
      "'latest' view not ranked by freshness_score.",
      "Expected: the latest-articles query sorts by freshness_score DESC",
      "instead of relying on published_at DESC alone."
    ].join(" ")).toBe(true);
  });
});
