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
import { InterestFamilyService } from "./interest-family-service.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("InterestFamilyService", () => {
  it("groups related subclusters without hard-merging different topics or polarities", () => {
    const db = createFamilyFixtureDatabase();
    try {
      insertFamilyCluster(db, {
        clusterId: "cluster_ai_agents",
        vector: [1, 0, 0],
        labelTerms: ["AI agents", "automation"],
        articleIds: ["article_ai_agents_1", "article_ai_agents_2"]
      });
      insertFamilyCluster(db, {
        clusterId: "cluster_ai_models",
        vector: [0.82, 0.57, 0],
        labelTerms: ["AI models", "automation"],
        articleIds: ["article_ai_models_1", "article_ai_models_2"]
      });
      insertFamilyCluster(db, {
        clusterId: "cluster_finance",
        vector: [0, 1, 0],
        labelTerms: ["markets", "earnings"],
        articleIds: ["article_finance_1", "article_finance_2"]
      });
      insertFamilyCluster(db, {
        clusterId: "cluster_negative_ai",
        vector: [0.98, 0.02, 0],
        labelTerms: ["AI agents", "automation"],
        articleIds: ["article_negative_ai_1"],
        polarity: "negative"
      });

      const service = new InterestFamilyService({ db, now: () => 6000 });

      expect(service.rebuildActiveIndexFamilies()).toMatchObject({
        embeddingIndexId: "index_family",
        familyCount: 3,
        memberCount: 4
      });

      const memberRows = db
        .prepare(
          `
            select cluster_id as clusterId, family_id as familyId, polarity
            from interest_cluster_family_members
            order by cluster_id
          `
        )
        .all() as Array<{ clusterId: string; familyId: string; polarity: string }>;
      const aiFamily = memberRows.find((row) => row.clusterId === "cluster_ai_agents")?.familyId;
      expect(memberRows.find((row) => row.clusterId === "cluster_ai_models")?.familyId).toBe(aiFamily);
      expect(memberRows.find((row) => row.clusterId === "cluster_finance")?.familyId).not.toBe(aiFamily);
      expect(memberRows.find((row) => row.clusterId === "cluster_negative_ai")?.familyId).not.toBe(aiFamily);

      const summary = service.listFamilySummary("index_family", 8);
      expect(summary.positive).toBe(2);
      expect(summary.negative).toBe(1);
      expect(summary.topFamilies.some((family) => family.clusterCount === 2)).toBe(true);
    } finally {
      db.close();
    }
  });

  it("keeps single-article families low maturity for ranking dampening", () => {
    const db = createFamilyFixtureDatabase();
    try {
      insertFamilyCluster(db, {
        clusterId: "cluster_single_article",
        vector: [1, 0, 0],
        labelTerms: ["AI agents"],
        articleIds: ["article_single"]
      });
      const service = new InterestFamilyService({ db, now: () => 6000 });

      service.rebuildActiveIndexFamilies();

      const family = service.listFamilySummary("index_family", 1).topFamilies[0];
      expect(family?.supportArticleCount).toBe(1);
      expect(family?.maturity).toBeLessThanOrEqual(0.35);
    } finally {
      db.close();
    }
  });
});

function createFamilyFixtureDatabase(): DibaoDatabase {
  const db = openDatabase(tempDatabasePath(), { migrate: true });
  const embeddings = new SqliteEmbeddingRepository(db);
  embeddings.upsertProvider({
    id: "provider_family",
    type: "openai_compatible",
    name: "Fixture Provider",
    baseUrl: "https://api.example.com/v1",
    model: "fixture",
    dimension: 3,
    enabled: true,
    now: 1000
  });
  embeddings.createIndex({
    id: "index_family",
    providerId: "provider_family",
    model: "fixture",
    dimension: 3,
    status: "active",
    now: 1000
  });
  return db;
}

function insertFamilyCluster(
  db: DibaoDatabase,
  input: {
    clusterId: string;
    vector: number[];
    labelTerms: string[];
    articleIds: string[];
    polarity?: "positive" | "negative";
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
    embeddingIndexId: "index_family",
    polarity,
    centroidVectorBlob: toVectorBlob(input.vector),
    weight: input.articleIds.length * 4,
    sampleCount: input.articleIds.length,
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
      polarity === "positive" ? "like" : "not_interested",
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
      values (?, ?, null, 'keywords', ?, ?, ?, null, 0.8, 5000, 5000)
    `
  ).run(
    input.clusterId,
    input.labelTerms.join(" / "),
    JSON.stringify(input.labelTerms.map((term) => ({ term, weight: 1 }))),
    JSON.stringify(input.articleIds.slice(0, 2).map((articleId) => ({ articleId, title: articleId }))),
    JSON.stringify([`Feed ${input.clusterId}`])
  );
}

function tempDatabasePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "dibao-family-"));
  tempDirs.push(dir);
  return join(dir, "dibao.sqlite");
}
