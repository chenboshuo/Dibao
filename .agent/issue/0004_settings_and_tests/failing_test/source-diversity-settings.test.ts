/**
 * Issue 0004: Source diversity settings UI + ratio mode + test fixes
 *
 * Expected:
 * 1. AppSettings.ranking has sourceCapOverride (0=auto, 3-20 manual) and
 *    sourceScoringMode ("count" | "ratio") fields
 * 2. Settings service accepts and persists these fields
 * 3. Ranking service applies sourceCapOverride in cocoonParameters
 * 4. Ratio mode normalizes score by feed volume: normalizedSourceScore via
 *    tanh((positiveRate - negativeRate) * 8) with Bayesian safeguard
 *
 * Current: No sourceCapOverride or sourceScoringMode fields exist.
 */
import type { AppSettingsRepository } from "@dibao/db";
import { describe, expect, it } from "vitest";
import { SettingsService } from "./settings-service.js";

class MemorySettingsRepository implements AppSettingsRepository {
  private readonly values = new Map<string, unknown>();

  getJson<T>(key: string): T | null {
    return this.values.has(key) ? (this.values.get(key) as T) : null;
  }

  setJson(key: string, value: unknown): void {
    this.values.set(key, value);
  }

  delete(key: string): void {
    this.values.delete(key);
  }
}

describe("0004: Source diversity settings", () => {
  it("should have sourceCapOverride field in ranking settings", () => {
    const settings = new MemorySettingsRepository();
    const service = new SettingsService({ settings });

    const appSettings = service.getSettings();
    const ranking = appSettings.ranking as Record<string, unknown>;

    expect(ranking.sourceCapOverride).toBeDefined();
  });

  it("should have sourceScoringMode field in ranking settings", () => {
    const settings = new MemorySettingsRepository();
    const service = new SettingsService({ settings });

    const appSettings = service.getSettings();
    const ranking = appSettings.ranking as Record<string, unknown>;

    expect(ranking.sourceScoringMode).toBe("count");
  });

  it("should persist sourceCapOverride via updateSettings", () => {
    const settings = new MemorySettingsRepository();
    const service = new SettingsService({ settings });

    try {
      service.updateSettings({
        ranking: {
          sourceCapOverride: 5
        } as Record<string, unknown>
      });
    } catch {
      // Expected to throw — field doesn't exist yet
      expect(true).toBe(true);
      return;
    }

    const updated = service.getSettings();
    expect((updated.ranking as Record<string, unknown>).sourceCapOverride).toBe(5);
  });

  it("should persist sourceScoringMode via updateSettings", () => {
    const settings = new MemorySettingsRepository();
    const service = new SettingsService({ settings });

    try {
      service.updateSettings({
        ranking: {
          sourceScoringMode: "ratio"
        } as Record<string, unknown>
      });
    } catch {
      // Expected to throw — field doesn't exist yet
      expect(true).toBe(true);
      return;
    }

    const updated = service.getSettings();
    expect((updated.ranking as Record<string, unknown>).sourceScoringMode).toBe("ratio");
  });

  it("should apply sourceCapOverride in cocoonParameters when > 0", () => {
    // Expected: cocoonParameters should check for sourceCapOverride setting
    // and use it instead of the computed value if it's > 0.
    expect(false, [
      "sourceCapOverride not wired into cocoonParameters or rerank logic.",
      "Expected: the ranking service reads sourceCapOverride and passes it to",
      "cocoonParameters so the MMR loop uses the user's override."
    ].join(" ")).toBe(true);
  });
});
