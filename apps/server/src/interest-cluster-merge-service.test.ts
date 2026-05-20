import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  openDatabase,
  SqliteArticleRepository,
  SqliteEmbeddingRepository,
  SqliteFeedRepository,
  SqliteProfileRepository,
  toVectorBlob,
  type DibaoDatabase
} from "@dibao/db";
import { InterestClusterLabelService } from "./interest-cluster-label-service.js";
import { InterestClusterMergeService } from "./interest-cluster-merge-service.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("InterestClusterMergeService", () => {
  it("creates same-polarity merge candidates from high centroid and label overlap", () => {
    const db = createMergeFixtureDatabase();
    try {
      insertCluster(db, {
        clusterId: "cluster_left",
        vector: [1, 0, 0],
        labelTerms: ["AI Agent", "CLI"],
        articleIds: ["article_shared", "article_left"]
      });
      insertCluster(db, {
        clusterId: "cluster_right",
        vector: [0.99, 0.01, 0],
        labelTerms: ["AI Agent", "CLI"],
        articleIds: ["article_shared", "article_right"]
      });
      const service = createMergeService(db);

      expect(service.rebuildActiveIndexCandidates()).toMatchObject({
        embeddingIndexId: "index_merge",
        candidateCount: 1
      });

      const candidates = service.listCandidates().candidates;
      expect(candidates).toHaveLength(1);
      expect(candidates[0]).toMatchObject({
        leftClusterId: "cluster_left",
        rightClusterId: "cluster_right",
        polarity: "positive",
        recommendation: "auto_merge",
        status: "open"
      });
    } finally {
      db.close();
    }
  });

  it("does not create candidates across polarity and keeps diagnostics read-only", () => {
    const db = createMergeFixtureDatabase();
    try {
      insertCluster(db, {
        clusterId: "cluster_positive",
        vector: [1, 0, 0],
        labelTerms: ["AI Agent"],
        articleIds: ["article_shared"],
        polarity: "positive"
      });
      insertCluster(db, {
        clusterId: "cluster_negative",
        vector: [0.99, 0.01, 0],
        labelTerms: ["AI Agent"],
        articleIds: ["article_shared"],
        polarity: "negative"
      });
      const beforeClusters = countRows(db, "interest_clusters");
      const service = createMergeService(db);

      expect(service.rebuildActiveIndexCandidates().candidateCount).toBe(0);

      expect(countRows(db, "interest_clusters")).toBe(beforeClusters);
      expect(
        db
          .prepare(
            "select count(*) as count from jobs where type in ('ranking_recalculate', 'embedding_generate')"
          )
          .get()
      ).toEqual({ count: 0 });
    } finally {
      db.close();
    }
  });

  it("uses more conservative auto-merge thresholds for negative clusters", () => {
    const db = createMergeFixtureDatabase();
    try {
      insertCluster(db, {
        clusterId: "cluster_negative_left",
        vector: [1, 0, 0],
        labelTerms: ["广告追踪", "营销"],
        articleIds: ["article_shared", "article_negative_left"],
        polarity: "negative"
      });
      insertCluster(db, {
        clusterId: "cluster_negative_right",
        vector: [0.94, 0.06, 0],
        labelTerms: ["广告追踪", "营销"],
        articleIds: ["article_shared", "article_negative_right"],
        polarity: "negative"
      });
      const service = createMergeService(db);

      service.rebuildActiveIndexCandidates();

      expect(service.listCandidates().candidates[0]?.recommendation).toBe("review");
    } finally {
      db.close();
    }
  });

  it("merges a reviewed candidate with survivor selection, evidence migration, and audit status", () => {
    const db = createMergeFixtureDatabase();
    try {
      insertCluster(db, {
        clusterId: "cluster_survivor",
        vector: [1, 0, 0],
        labelTerms: ["AI Agent", "CLI"],
        articleIds: ["article_shared", "article_survivor"],
        weight: 8,
        manualLabel: "AI 编程代理"
      });
      insertCluster(db, {
        clusterId: "cluster_merged",
        vector: [0.99, 0.01, 0],
        labelTerms: ["AI Agent", "CLI"],
        articleIds: ["article_shared", "article_merged"],
        weight: 4
      });
      const service = createMergeService(db);
      service.rebuildActiveIndexCandidates();
      const candidate = service.listCandidates().candidates[0]!;

      const result = service.mergeCandidate(candidate.id);

      expect(result).toMatchObject({
        ok: true,
        survivorClusterId: "cluster_survivor",
        mergedAwayClusterId: "cluster_merged"
      });
      expect(
        db.prepare("select count(*) as count from interest_clusters where id = 'cluster_merged'").get()
      ).toEqual({ count: 0 });
      expect(
        db.prepare("select weight, sample_count as sampleCount from interest_clusters where id = 'cluster_survivor'").get()
      ).toMatchObject({ weight: 12, sampleCount: 4 });
      expect(
        db
          .prepare(
            "select count(*) as count from interest_cluster_evidence where cluster_id = 'cluster_merged'"
          )
          .get()
      ).toEqual({ count: 0 });
      expect(
        db
          .prepare("select status from interest_cluster_merge_candidates where id = ?")
          .get(candidate.id)
      ).toEqual({ status: "merged" });
      expect(
        db
          .prepare("select manual_label as manualLabel from interest_cluster_labels where cluster_id = 'cluster_survivor'")
          .get()
      ).toEqual({ manualLabel: "AI 编程代理" });
    } finally {
      db.close();
    }
  });

  it("ignores a candidate without changing clusters", () => {
    const db = createMergeFixtureDatabase();
    try {
      insertCluster(db, {
        clusterId: "cluster_ignore_left",
        vector: [1, 0, 0],
        labelTerms: ["AI Agent"],
        articleIds: ["article_shared"]
      });
      insertCluster(db, {
        clusterId: "cluster_ignore_right",
        vector: [0.99, 0.01, 0],
        labelTerms: ["AI Agent"],
        articleIds: ["article_shared"]
      });
      const service = createMergeService(db);
      service.rebuildActiveIndexCandidates();
      const candidate = service.listCandidates().candidates[0]!;
      const beforeClusters = countRows(db, "interest_clusters");

      expect(service.ignoreCandidate(candidate.id)).toEqual({
        ok: true,
        candidateId: candidate.id,
        status: "ignored"
      });

      expect(countRows(db, "interest_clusters")).toBe(beforeClusters);
      expect(
        db.prepare("select status from interest_cluster_merge_candidates where id = ?").get(candidate.id)
      ).toEqual({ status: "ignored" });
    } finally {
      db.close();
    }
  });
});

function createMergeService(db: DibaoDatabase): InterestClusterMergeService {
  const labels = new InterestClusterLabelService({ db, now: () => 10_000 });
  return new InterestClusterMergeService({ db, clusterLabels: labels, now: () => 10_000 });
}

function createMergeFixtureDatabase(): DibaoDatabase {
  const db = openDatabase(tempDatabasePath(), { migrate: true });
  const embeddings = new SqliteEmbeddingRepository(db);
  embeddings.upsertProvider({
    id: "provider_merge",
    type: "openai_compatible",
    name: "Fixture Provider",
    baseUrl: "https://api.example.com/v1",
    model: "fixture",
    dimension: 3,
    enabled: true,
    now: 1000
  });
  embeddings.createIndex({
    id: "index_merge",
    providerId: "provider_merge",
    model: "fixture",
    dimension: 3,
    status: "active",
    now: 1000
  });
  return db;
}

function insertCluster(
  db: DibaoDatabase,
  input: {
    clusterId: string;
    vector: number[];
    labelTerms: string[];
    articleIds: string[];
    polarity?: "positive" | "negative";
    weight?: number;
    manualLabel?: string;
  }
): void {
  const feeds = new SqliteFeedRepository(db);
  const articles = new SqliteArticleRepository(db);
  const profiles = new SqliteProfileRepository(db);
  const polarity = input.polarity ?? "positive";
  feeds.upsert({
    id: `feed_${input.clusterId}`,
    title: `Feed ${input.clusterId}`,
    feedUrl: `https://example.com/${input.clusterId}.xml`,
    now: 2000
  });
  profiles.upsertCluster({
    id: input.clusterId,
    embeddingIndexId: "index_merge",
    polarity,
    centroidVectorBlob: toVectorBlob(input.vector),
    weight: input.weight ?? 5,
    sampleCount: 2,
    now: 3000
  });
  for (const articleId of input.articleIds) {
    articles.upsert({
      id: articleId,
      feedId: `feed_${input.clusterId}`,
      url: `https://example.com/${articleId}`,
      title: `${input.labelTerms.join(" ")} ${articleId}`,
      summary: input.labelTerms.join(" "),
      discoveredAt: 3000,
      dedupeKey: articleId,
      now: 3000
    });
    db.prepare(
      `
        insert or ignore into behavior_events (
          id,
          article_id,
          event_type,
          event_weight,
          created_at
        )
        values (?, ?, ?, ?, 3500)
      `
    ).run(
      `event_${input.clusterId}_${articleId}`,
      articleId,
      polarity === "positive" ? "favorite" : "not_interested",
      polarity === "positive" ? 4 : -4
    );
    profiles.insertClusterEvidence({
      id: `evidence_${input.clusterId}_${articleId}`,
      clusterId: input.clusterId,
      articleId,
      behaviorEventId: `event_${input.clusterId}_${articleId}`,
      evidenceSource: "live_event",
      confidence: 0.9,
      similarity: 0.96,
      weightDelta: polarity === "positive" ? 4 : -4,
      createdAt: 4000
    });
  }
  db.prepare(
    `
      insert into interest_cluster_labels (
        cluster_id,
        auto_label,
        manual_label,
        label_source,
        label_terms_json,
        representative_articles_json,
        feed_titles_json,
        label_diagnostics_json,
        confidence,
        generated_at,
        updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, null, 0.8, 5000, 5000)
    `
  ).run(
    input.clusterId,
    input.labelTerms.join(" / "),
    input.manualLabel ?? null,
    input.manualLabel ? "manual" : "keywords",
    JSON.stringify(input.labelTerms.map((term) => ({ term, weight: 1 }))),
    JSON.stringify(input.articleIds.slice(0, 2).map((articleId) => ({ articleId, title: articleId }))),
    JSON.stringify([`Feed ${input.clusterId}`])
  );
}

function countRows(db: DibaoDatabase, tableName: string): number {
  const row = db.prepare(`select count(*) as count from ${tableName}`).get() as
    | { count: number }
    | undefined;
  return row?.count ?? 0;
}

function tempDatabasePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "dibao-cluster-merge-"));
  tempDirs.push(dir);
  return join(dir, "dibao.sqlite");
}
