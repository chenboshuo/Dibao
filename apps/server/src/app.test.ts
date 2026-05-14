import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  openDatabase,
  SqliteArticleRepository,
  SqliteFeedRepository,
  type DibaoDatabase
} from "@dibao/db";
import { buildServer } from "./app.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("server API vertical slice", () => {
  it("reports database, FTS, and vector-store health", async () => {
    const db = createFixtureDatabase();
    const app = buildServer({ db, logger: false });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/system/health"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        data: {
          ok: true,
          database: "ok",
          fts: "ok",
          vectorStore: "ok",
          version: "0.0.0"
        }
      });
    } finally {
      await app.close();
      db.close();
    }
  });

  it("lists feeds from the migrated database with API timestamps", async () => {
    const db = createFixtureDatabase();
    const app = buildServer({ db, logger: false });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/feeds?enabled=true"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        data: [
          {
            id: "feed_design",
            folderId: null,
            title: "Design Notes",
            siteUrl: "https://example.com",
            feedUrl: "https://example.com/feed.xml",
            description: null,
            enabled: true,
            sourceWeight: 0,
            lastFetchedAt: null,
            lastSuccessAt: null,
            lastError: null,
            createdAt: "1970-01-01T00:00:01.000Z",
            updatedAt: "1970-01-01T00:00:01.000Z"
          }
        ]
      });
    } finally {
      await app.close();
      db.close();
    }
  });

  it("lists and paginates article summaries", async () => {
    const db = createFixtureDatabase();
    const app = buildServer({ db, logger: false });

    try {
      const firstPage = await app.inject({
        method: "GET",
        url: "/api/articles?view=latest&limit=1"
      });
      const firstBody = firstPage.json();

      expect(firstPage.statusCode).toBe(200);
      expect(firstBody.data).toHaveLength(1);
      expect(firstBody.data[0]).toMatchObject({
        id: "article_recent",
        feedId: "feed_design",
        feedTitle: "Design Notes",
        title: "Dense reader interfaces",
        publishedAt: "1970-01-01T00:00:03.000Z",
        discoveredAt: "1970-01-01T00:00:03.000Z",
        state: {
          read: true,
          favorited: true,
          readLater: false,
          hidden: false,
          notInterested: false,
          readingProgress: 0.5
        }
      });
      expect(firstBody.page.nextCursor).toEqual(expect.any(String));

      const secondPage = await app.inject({
        method: "GET",
        url: `/api/articles?view=latest&limit=1&cursor=${firstBody.page.nextCursor}`
      });

      expect(secondPage.statusCode).toBe(200);
      expect(secondPage.json()).toMatchObject({
        data: [
          {
            id: "article_recommended",
            title: "Quiet ranking systems",
            state: {
              read: false,
              favorited: false,
              readLater: false,
              hidden: false,
              notInterested: false,
              readingProgress: 0
            }
          }
        ],
        page: {
          nextCursor: null
        }
      });
    } finally {
      await app.close();
      db.close();
    }
  });

  it("orders recommended articles by stored rank scores", async () => {
    const db = createFixtureDatabase();
    const app = buildServer({ db, logger: false });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/articles?view=recommended"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.map((article: { id: string }) => article.id)).toEqual([
        "article_recommended",
        "article_recent"
      ]);
    } finally {
      await app.close();
      db.close();
    }
  });

  it("returns article details with content and state", async () => {
    const db = createFixtureDatabase();
    const app = buildServer({ db, logger: false });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/articles/article_recent"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        data: {
          id: "article_recent",
          contentHtml: "<p>Reader density without visual clutter.</p>",
          contentText: "Reader density without visual clutter.",
          extractionStatus: "success",
          extractionError: null,
          rank: {
            score: 0.4,
            calculatedAt: "1970-01-01T00:00:04.000Z"
          }
        }
      });
    } finally {
      await app.close();
      db.close();
    }
  });

  it("returns a contract-shaped error for missing articles", async () => {
    const db = createFixtureDatabase();
    const app = buildServer({ db, logger: false });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/articles/missing"
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        error: {
          code: "NOT_FOUND",
          message: "Article not found"
        }
      });
    } finally {
      await app.close();
      db.close();
    }
  });
});

function createFixtureDatabase(): DibaoDatabase {
  const db = openDatabase(tempDatabasePath(), { migrate: true });
  const feeds = new SqliteFeedRepository(db);
  const articles = new SqliteArticleRepository(db);

  feeds.upsert({
    id: "feed_design",
    title: "Design Notes",
    feedUrl: "https://example.com/feed.xml",
    siteUrl: "https://example.com",
    now: 1000
  });
  feeds.upsert({
    id: "feed_disabled",
    title: "Disabled Feed",
    feedUrl: "https://example.com/disabled.xml",
    enabled: false,
    now: 1000
  });

  articles.upsert({
    id: "article_recommended",
    feedId: "feed_design",
    url: "https://example.com/recommended",
    canonicalUrl: "https://example.com/recommended",
    title: "Quiet ranking systems",
    summary: "Ranking without theatrics.",
    publishedAt: 2000,
    discoveredAt: 2000,
    dedupeKey: "recommended",
    now: 2000
  });
  articles.upsert({
    id: "article_recent",
    feedId: "feed_design",
    url: "https://example.com/recent",
    canonicalUrl: "https://example.com/recent",
    title: "Dense reader interfaces",
    summary: "A practical reader layout.",
    publishedAt: 3000,
    discoveredAt: 3000,
    dedupeKey: "recent",
    now: 3000
  });
  articles.upsertContent({
    articleId: "article_recent",
    contentHtml: "<p>Reader density without visual clutter.</p>",
    contentText: "Reader density without visual clutter.",
    extractionStatus: "success",
    extractedAt: 3000,
    now: 3000
  });

  db.prepare(
    `
      insert into article_states (
        article_id,
        read_at,
        favorited_at,
        read_later_at,
        hidden_at,
        not_interested_at,
        reading_progress,
        last_opened_at,
        updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run("article_recent", 3500, 3500, null, null, null, 0.5, 3500, 3500);

  insertRank(db, "article_recommended", 0.9, 4000);
  insertRank(db, "article_recent", 0.4, 4000);

  return db;
}

function insertRank(db: DibaoDatabase, articleId: string, score: number, calculatedAt: number): void {
  db.prepare(
    `
      insert into article_rank_scores (
        article_id,
        rank_context,
        embedding_index_id,
        score,
        interest_score,
        source_score,
        freshness_score,
        state_score,
        diversity_score,
        penalty_score,
        calculated_at
      )
      values (?, 'base', null, ?, 0, 0, 0, 0, 0, 0, ?)
    `
  ).run(articleId, score, calculatedAt);
}

function tempDatabasePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "dibao-server-"));
  tempDirs.push(dir);
  return join(dir, "dibao.sqlite");
}
