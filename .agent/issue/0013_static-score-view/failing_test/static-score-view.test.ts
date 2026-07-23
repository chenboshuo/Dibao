/**
 * Issue 0013: Static scoring components should be derived via SQL views
 *
 * Expected:
 * 1. A SQL view `article_static_scores` exists that derives freshnessScore,
 *    sourceScore, and stateScore via JOIN + expression
 * 2. The ranking service reads from this view instead of recomputing
 *    these deterministic components in TypeScript
 * 3. Only dynamic components (semantic matching, FTRL, diversity rerank)
 *    remain in procedural code
 *
 * Current: No SQL views exist in any migration. All three static score
 * components are recomputed on every recalc cycle inside writeScores().
 * The article_rank_scores table acts as a materialized cache with no
 * invalidation logic.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  getAppliedMigrations,
  loadDefaultMigrations,
  openDatabase,
  runMigrations
} from "./index.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("0013: Static score SQL view", () => {
  it("should have article_static_scores SQL view", () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "dibao-static-score-view-")), "test.sqlite");
    tempDirs.push(dbPath);

    const db = openDatabase(dbPath);
    runMigrations(db, loadDefaultMigrations());

    // Create custom view to get all views
    const views = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'view' ORDER BY name")
      .all() as Array<{ name: string }>;

    // Expected: article_static_scores view exists
    const hasStaticScoreView = views.some((v) => v.name === "article_static_scores");

    expect(
      hasStaticScoreView,
      [
        "article_static_scores view not found.",
        "Current views:",
        ...views.map((v) => `  - ${v.name}`)
      ].join("\n")
    ).toBe(true);
  });

  it("should derive freshnessScore from published_at / discovered_at", () => {
    // Expected: The view computes freshnessScore as:
    //   exp(-(now - coalesce(published_at, discovered_at)) / 129600000) * 0.18
    expect(false, [
      "No SQL view derives freshnessScore.",
      "Expected: article_static_scores view with a freshnessScore expression.",
      "Currently computed in TypeScript at packages/ranking/src/index.ts:135."
    ].join(" ")).toBe(true);
  });

  it("should derive sourceScore from feeds.source_weight and feed_stats", () => {
    // Expected: The view JOINs feeds and feed_stats to compute sourceScore
    // via SQL expression instead of TypeScript.
    expect(false, [
      "No SQL view derives sourceScore.",
      "Expected: article_static_scores JOINs feeds + feed_stats to compute",
      "sourceScore as a SQL expression."
    ].join(" ")).toBe(true);
  });

  it("should derive stateScore from article_states", () => {
    // Expected: The view JOINs article_states to compute stateScore
    // based on read_at, read_later_at, etc.
    expect(false, [
      "No SQL view derives stateScore.",
      "Expected: article_static_scores JOINs article_states to compute",
      "stateScore as a SQL expression."
    ].join(" ")).toBe(true);
  });
});
