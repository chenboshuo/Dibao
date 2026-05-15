import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  openDatabase,
  SqliteArticleRepository,
  SqliteFeedRepository,
  SqliteJobRepository,
  type DibaoDatabase,
  type JobRow
} from "@dibao/db";
import {
  FeedRefreshCoordinator,
  FeedRefreshJobService,
  FeedRefreshScheduler
} from "./feed-refresh-job-service.js";
import { FeedRefreshService, type FeedFetcher } from "./feed-refresh-service.js";
import { JobRunner } from "./job-runner.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("job runner foundation", () => {
  it("continues running queued jobs after one job fails", async () => {
    const db = createEmptyDatabase();
    const jobs = new SqliteJobRepository(db);
    const calls: string[] = [];

    try {
      jobs.enqueue({
        id: "job_fail",
        type: "feed_refresh",
        payloadJson: JSON.stringify({ feedId: "feed_fail" }),
        maxAttempts: 1,
        runAfter: 1000,
        now: 1000
      });
      jobs.enqueue({
        id: "job_success",
        type: "feed_refresh",
        payloadJson: JSON.stringify({ feedId: "feed_success" }),
        maxAttempts: 1,
        runAfter: 1000,
        now: 1000
      });

      const runner = new JobRunner({
        jobs,
        handlers: {
          feed_refresh: (job) => {
            calls.push(job.id);
            if (job.id === "job_fail") {
              throw new Error("fixture failure");
            }
          }
        },
        now: () => 2000,
        retryDelayMs: 1000
      });

      await expect(runner.drainDue()).resolves.toBe(2);
      expect(calls).toEqual(["job_fail", "job_success"]);
      expect(jobs.findById("job_fail")).toMatchObject({
        status: "failed",
        attempts: 1,
        error: "fixture failure"
      });
      expect(jobs.findById("job_success")).toMatchObject({
        status: "succeeded",
        attempts: 1,
        error: null
      });
    } finally {
      db.close();
    }
  });

  it("fails invalid feed refresh payloads without crashing the runner", async () => {
    const db = createEmptyDatabase();
    const jobs = new SqliteJobRepository(db);
    const feeds = new SqliteFeedRepository(db);
    let refreshCalled = false;

    try {
      jobs.enqueue({
        id: "job_invalid_payload",
        type: "feed_refresh",
        payloadJson: JSON.stringify({ feedId: 42 }),
        maxAttempts: 3,
        runAfter: 1000,
        now: 1000
      });
      const refreshJobs = new FeedRefreshJobService({
        feeds,
        jobs,
        refresher: {
          async refreshFeed() {
            refreshCalled = true;
            throw new Error("should not refresh invalid payload");
          }
        },
        now: () => 2000
      });
      const runner = new JobRunner({
        jobs,
        handlers: {
          feed_refresh: (job) => refreshJobs.handleFeedRefreshJob(job)
        },
        now: () => 2000
      });

      await expect(runner.runDueOnce()).resolves.toMatchObject({
        id: "job_invalid_payload"
      });
      expect(refreshCalled).toBe(false);
      expect(jobs.findById("job_invalid_payload")).toMatchObject({
        status: "failed",
        attempts: 1,
        error: "Invalid feed_refresh job payload"
      });
    } finally {
      db.close();
    }
  });

  it("refreshes enabled feeds through jobs and isolates feed failures", async () => {
    const db = createEmptyDatabase();
    const feeds = new SqliteFeedRepository(db);
    const articles = new SqliteArticleRepository(db);
    const jobs = new SqliteJobRepository(db);
    let jobSequence = 0;

    try {
      feeds.upsert({
        id: "feed_success",
        title: "Alpha Success Feed",
        feedUrl: "https://example.com/success.xml",
        enabled: true,
        now: 1000
      });
      feeds.upsert({
        id: "feed_failure",
        title: "Zulu Failure Feed",
        feedUrl: "https://example.com/failure.xml",
        enabled: true,
        now: 1000
      });
      feeds.upsert({
        id: "feed_disabled",
        title: "Disabled Feed",
        feedUrl: "https://example.com/disabled.xml",
        enabled: false,
        now: 1000
      });

      const refreshService = new FeedRefreshService({
        db,
        feeds,
        articles,
        fetcher: fixtureFetcher({
          "https://example.com/success.xml": fixtureRss
        }),
        now: () => 3000
      });
      const refreshJobs = new FeedRefreshJobService({
        feeds,
        jobs,
        refresher: new FeedRefreshCoordinator({ refreshService }),
        jobIdFactory: () => `job_${++jobSequence}`,
        maxAttempts: 1,
        now: () => 2000
      });
      const runner = new JobRunner({
        jobs,
        handlers: {
          feed_refresh: (job) => refreshJobs.handleFeedRefreshJob(job)
        },
        now: () => 3000,
        retryDelayMs: 1000
      });

      const firstBatch = refreshJobs.enqueueAllEnabledFeeds();
      const secondBatch = refreshJobs.enqueueAllEnabledFeeds();
      expect(firstBatch.map((job) => job.id)).toEqual(["job_1", "job_2"]);
      expect(secondBatch.map((job) => job.id)).toEqual(["job_1", "job_2"]);
      expect(jobs.listOpenByType("feed_refresh")).toHaveLength(2);

      await expect(runner.drainDue()).resolves.toBe(2);
      expect(articles.list({ feedId: "feed_success" })).toMatchObject({
        items: [
          expect.objectContaining({
            title: "Job runner article"
          })
        ]
      });
      expect(feeds.findById("feed_success")).toMatchObject({
        lastFetchedAt: 3000,
        lastSuccessAt: 3000,
        lastError: null
      });
      expect(feeds.findById("feed_failure")).toMatchObject({
        lastFetchedAt: 3000,
        lastSuccessAt: null,
        lastError: "Feed fetch failed"
      });
      expect(feeds.findById("feed_disabled")).toMatchObject({
        lastFetchedAt: null,
        lastSuccessAt: null,
        lastError: null
      });
      expect(jobs.findById("job_1")).toMatchObject({
        status: "succeeded"
      });
      expect(jobs.findById("job_2")).toMatchObject({
        status: "failed",
        error: "Feed fetch failed"
      });
    } finally {
      db.close();
    }
  });

  it("scheduler tick enqueues refresh jobs and wakes the runner without using a real interval", async () => {
    let drained = false;
    const scheduler = new FeedRefreshScheduler({
      refreshJobs: {
        enqueueAllEnabledFeeds: () => [minimalJob("job_1")]
      },
      runner: {
        async drainDue() {
          drained = true;
          return 0;
        }
      },
      intervalMs: 60_000
    });

    await expect(scheduler.tick()).resolves.toEqual(["job_1"]);
    expect(drained).toBe(true);
  });
});

function createEmptyDatabase(): DibaoDatabase {
  return openDatabase(tempDatabasePath(), { migrate: true });
}

function tempDatabasePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "dibao-server-jobs-"));
  tempDirs.push(dir);
  return join(dir, "dibao.sqlite");
}

function fixtureFetcher(fixtures: Record<string, string>): FeedFetcher {
  return async (url) => ({
    ok: fixtures[url] !== undefined,
    status: fixtures[url] === undefined ? 502 : 200,
    statusText: fixtures[url] === undefined ? "Bad Gateway" : "OK",
    async text() {
      return fixtures[url] ?? "";
    }
  });
}

function minimalJob(id: string): JobRow {
  return {
    id,
    type: "feed_refresh",
    status: "queued",
    payloadJson: JSON.stringify({ feedId: "feed_fixture" }),
    error: null,
    attempts: 0,
    maxAttempts: 3,
    runAfter: 1000,
    startedAt: null,
    finishedAt: null,
    createdAt: 1000,
    updatedAt: 1000
  };
}

const fixtureRss = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Job Runner Feed</title>
    <link>https://example.com</link>
    <description>Fixture feed</description>
    <item>
      <title>Job runner article</title>
      <link>https://example.com/job-runner</link>
      <guid>job-runner</guid>
      <pubDate>Thu, 14 May 2026 08:00:00 GMT</pubDate>
      <description>Queued refresh content.</description>
    </item>
  </channel>
</rss>`;
