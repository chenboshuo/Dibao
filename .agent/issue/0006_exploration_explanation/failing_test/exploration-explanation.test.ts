/**
 * Issue 0006: Cocoon-breaking exploration explanation lacks transparency in frontend
 *
 * Expected:
 * 1. The API response for articles surfaced by exploration includes
 *    explorationBucket ("pending_embedding" | "feed") and explorationReason
 * 2. The frontend rendering code displays these fields in the reason text
 *    or score breakdown panel
 *
 * Current: The backend `explanationPayloadFor()` already includes
 * explorationBucket and explorationReason, but the frontend rendering
 * code in App.tsx doesn't use them.
 */
import { describe, expect, it } from "vitest";

describe("0006: Exploration explanation transparency", () => {
  it("should display exploration bucket and reason in the frontend", () => {
    // Expected: When an article has wasExploration=true, the reason display
    // includes explorationBucket and explorationReason fields from the API response.
    //
    // Current: Only shows generic "本文由破茧算法打捞" text and explorationScore.
    // The backend sends explorationBucket and explorationReason but App.tsx
    // does not render them.
    //
    // Relevant code: apps/web/src/App.tsx ~line 9741 (reason-type rendering)
    expect(false, [
      "Exploration bucket and reason not displayed in frontend.",
      "Backend in ranking-service.ts:1849-1851 already sends explorationBucket",
      "and explorationReason in explanationPayloadFor(), but App.tsx does not",
      "render them. See 0006 issue for proposed fix."
    ].join(" ")).toBe(true);
  });
});
