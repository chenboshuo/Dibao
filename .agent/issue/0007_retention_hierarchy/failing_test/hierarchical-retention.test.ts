/**
 * Issue 0007: Introduce hierarchical retention policy to replace single retentionDays
 *
 * Expected:
 * 1. Retention policy has multiple dimensions: content type (feed/folder tiers),
 *    scoring signals (interestScore, freshnessScore, penaltyScore), user interaction
 *    (favorites, read-later), and time (retentionDays)
 * 2. ArticleRetentionService supports tier-based policy with score-aware eviction
 * 3. Settings have per-feed retention configurations
 *
 * Current: Single global retentionDays (default 0 = keep forever), with optional
 * keepFavorites/keepReadLater flags. No tier system or score-aware cleanup.
 */
import type { AppSettingsRepository, ArticleRepository } from "@dibao/db";
import { describe, expect, it } from "vitest";
import { ArticleRetentionService } from "./article-retention-service.js";

class MemoryAppSettings implements AppSettingsRepository {
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

function noopArticleRepo(): Pick<ArticleRepository, "cleanupForRetention" | "listRetentionCandidates"> {
  return {
    cleanupForRetention: async () => ({ deletedArticleCount: 0, deletedEventCount: 0 }),
    listRetentionCandidates: async () => ({ articleIds: [], hasMore: false })
  };
}

describe("0007: Hierarchical retention policy", () => {
  it("should support retention tiers beyond single retentionDays", () => {
    // Expected: Retention policy has a tier system where different tiers
    // (e.g., "flash", "normal", "deep") have different retention periods.
    // Each feed can be assigned to a tier.
    const settings = new MemoryAppSettings();
    const service = new ArticleRetentionService({
      settings,
      articles: noopArticleRepo(),
      vectorStore: { deleteArticleVectors: async () => {} }
    });

    const policy = service.getRetentionPolicy();

    // Expected: policy has a `tiers` or similar field instead of just
    // keepFavorites/keepReadLater
    expect((policy as Record<string, unknown>).tiers).toBeDefined();
  });

  it("should evict low-scoring articles before high-scoring ones", () => {
    // Expected: When retention cleanup runs, it considers rank scores
    // (interestScore, freshnessScore, penaltyScore) in eviction order.
    // Low-scoring articles are evicted first.
    expect(false, [
      "Score-aware eviction not implemented. Current retention logic",
      "only uses time-based blanket cutoff: coalesce(published_at, discovered_at)",
      "< cutoff. See article-retention-service.ts."
    ].join(" ")).toBe(true);
  });

  it("should allow per-feed or per-folder retention configuration", () => {
    // Expected: Users can configure retention at the feed or folder level,
    // overriding the global retentionDays default.
    expect(false, [
      "Per-feed/folder retention not implemented.",
      "Expected: source-level retention settings that override the global default."
    ].join(" ")).toBe(true);
  });
});
