/**
 * Issue 0010: All feeds not updating — DIBAO_BACKGROUND_JOBS not set
 *
 * Expected: backgroundJobs should default to true (opt-out) so that
 * restarting the server without setting DIBAO_BACKGROUND_JOBS=true
 * still runs the JobRunner.
 *
 * Current: `backgroundJobs: process.env.DIBAO_BACKGROUND_JOBS === "true"`
 * in apps/server/src/index.ts:8 — opt-in only. Without the env var,
 * backgroundJobs defaults to false and all jobs stall.
 */
import { describe, expect, it } from "vitest";

describe("0010: Background jobs default", () => {
  it("should enable background jobs when DIBAO_BACKGROUND_JOBS is not set", () => {
    // Expected: `backgroundJobs` defaults to `true` when
    // `process.env.DIBAO_BACKGROUND_JOBS` is undefined.
    //
    // Current (index.ts:8):
    //   backgroundJobs: process.env.DIBAO_BACKGROUND_JOBS === "true",
    // This resolves to `false` when the env var is not set,
    // stopping JobRunner, schedulers, and plugin background tasks.
    expect(false, [
      "backgroundJobs does not default to true.",
      "Code at apps/server/src/index.ts:8 uses strict === 'true' comparison.",
      "Expected: DIBAO_BACKGROUND_JOBS !== 'false' (opt-out) instead of",
      "=== 'true' (opt-in). See issue 0010 for discussion."
    ].join(" ")).toBe(true);
  });
});
