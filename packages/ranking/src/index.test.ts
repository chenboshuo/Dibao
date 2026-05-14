import { describe, expect, it } from "vitest";
import { clamp, freshnessScore, profileAlgorithmDefaults } from "./index.js";

describe("ranking package", () => {
  it("exports conservative Profile Algorithm defaults", () => {
    expect(profileAlgorithmDefaults.maxPositiveClusters).toBe(24);
    expect(profileAlgorithmDefaults.negativeMergeThreshold).toBeGreaterThan(
      profileAlgorithmDefaults.positiveMergeThreshold
    );
  });

  it("clamps values", () => {
    expect(clamp(2, 0, 1)).toBe(1);
    expect(clamp(-1, 0, 1)).toBe(0);
  });

  it("decays freshness as articles age", () => {
    expect(freshnessScore(0)).toBeGreaterThan(freshnessScore(72));
  });
});

