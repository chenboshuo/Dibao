import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  openDatabase,
  SqliteArticleRepository,
  SqliteEmbeddingRepository,
  SqliteJobRepository,
  SqliteProfileRepository,
  SqliteRankingRepository,
  SqliteVecVectorStore,
  toVectorBlob,
  type DibaoDatabase
} from "../../packages/db/src/index.js";
import { JobRunner } from "../../apps/server/src/job-runner.js";
import {
  RankingRecalculateJobService,
  RANKING_RECALCULATE_JOB_TYPE
} from "../../apps/server/src/ranking-job-service.js";
import { RecommendationRankingService } from "../../apps/server/src/ranking-service.js";
import { buildServer } from "../../apps/server/src/app.js";

const articleCount = Number(process.env.DIBAO_PERF_ARTICLES ?? 20_000);
const feedCount = Number(process.env.DIBAO_PERF_FEEDS ?? 100);
const databasePath = resolve(process.env.DIBAO_PERF_DB ?? ".tmp/perf/recommendation-20k.sqlite");
const reportPath = resolve("docs/recommendation-performance.md");
const now = Date.parse("2026-05-16T00:00:00.000Z");

mkdirSync(dirname(databasePath), { recursive: true });
rmSync(databasePath, { force: true });
rmSync(`${databasePath}-wal`, { force: true });
rmSync(`${databasePath}-shm`, { force: true });

const db = openDatabase(databasePath, { migrate: true });

try {
  console.log(`Generating ${articleCount} articles across ${feedCount} feeds...`);
  const generateMs = measure(() => generateDataset(db));

  const embeddings = new SqliteEmbeddingRepository(db);
  const articles = new SqliteArticleRepository(db);
  const rankings = new SqliteRankingRepository(db);
  const profiles = new SqliteProfileRepository(db);
  const jobs = new SqliteJobRepository(db);
  const ranking = new RecommendationRankingService({
    embeddings,
    profiles,
    rankings,
    now: () => now
  });
  const rankingJobs = new RankingRecalculateJobService({
    jobs,
    ranking,
    now: () => now
  });
  const runner = new JobRunner({
    jobs,
    handlers: {
      [RANKING_RECALCULATE_JOB_TYPE]: (job) => rankingJobs.handleRankingRecalculateJob(job)
    },
    now: () => now
  });

  const rankingMs = await measureAsync(async () => {
    rankingJobs.enqueueAll();
    await runner.drainDue();
  });
  const rankingJobsSucceeded = jobs.countByTypeAndStatus(RANKING_RECALCULATE_JOB_TYPE, "succeeded");

  const embeddingCandidateMs = measure(() => {
    articles.listEmbeddingCandidates({
      embeddingIndexId: "index_perf",
      limit: 1_000
    });
  });

  const app = buildServer({
    db,
    authRequired: false,
    backgroundJobs: false,
    closeDatabaseOnClose: false,
    logger: false
  });
  const recommendedMs = await measureAsync(async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/articles?view=recommended&limit=50"
    });
    if (response.statusCode !== 200) {
      throw new Error(response.body);
    }
  });
  const diagnosticsMs = await measureAsync(async () => {
    const indexes = await app.inject({
      method: "GET",
      url: "/api/embedding/indexes"
    });
    const status = await app.inject({
      method: "GET",
      url: "/api/recommendation/status"
    });
    if (indexes.statusCode !== 200 || status.statusCode !== 200) {
      throw new Error(`${indexes.body}\n${status.body}`);
    }
  });
  await app.close();

  const report = `# Recommendation Performance

Generated at: ${new Date().toISOString()}

Dataset:

- Articles: ${articleCount}
- Feeds: ${feedCount}
- Daily distribution: 300-400 new articles/day over recent history
- Behavior events: favorites, read later, read progress, hides, not interested, opens
- Embedding vectors: local deterministic 4-dimensional vectors in \`article_embeddings\` and sqlite-vec
- Database: \`${databasePath}\`

Results:

| Check | Result |
| --- | ---: |
| Dataset generation | ${generateMs.toFixed(1)} ms |
| Ranking chunk job drain | ${rankingMs.toFixed(1)} ms |
| Ranking jobs succeeded | ${rankingJobsSucceeded} |
| Embedding candidate query | ${embeddingCandidateMs.toFixed(1)} ms |
| Recommended API | ${recommendedMs.toFixed(1)} ms |
| Diagnostics/index API | ${diagnosticsMs.toFixed(1)} ms |

Notes:

- This script is a manual release gate and is not part of \`npm test\`.
- Ranking runs through \`ranking_recalculate\` chunk jobs with the default 500 article chunk size.
- The embedding candidate query intentionally leaves a small stale set so missing/stale backfill paths are exercised.
`;

  writeFileSync(reportPath, report);
  console.log(report);
} finally {
  db.close();
}

function generateDataset(db: DibaoDatabase): void {
  const insertFeed = db.prepare(`
    insert into feeds (id, title, feed_url, enabled, source_weight, created_at, updated_at)
    values (?, ?, ?, 1, ?, ?, ?)
  `);
  const insertArticle = db.prepare(`
    insert into articles (
      id, feed_id, guid, url, canonical_url, title, summary,
      published_at, discovered_at, content_hash, dedupe_key, status, created_at, updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
  `);
  const insertContent = db.prepare(`
    insert into article_contents (
      article_id, content_html, content_text, extraction_status, extracted_at, updated_at
    )
    values (?, null, ?, 'success', ?, ?)
  `);
  const insertState = db.prepare(`
    insert into article_states (
      article_id, read_at, favorited_at, read_later_at, hidden_at, not_interested_at,
      reading_progress, last_opened_at, updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertEvent = db.prepare(`
    insert into behavior_events (id, article_id, event_type, event_weight, metadata_json, created_at)
    values (?, ?, ?, ?, ?, ?)
  `);
  const insertFeedStats = db.prepare(`
    insert into feed_stats (
      feed_id, positive_score, negative_score, open_rate, favorite_rate,
      not_interested_rate, last_calculated_at
    )
    values (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertProvider = db.prepare(`
    insert into embedding_providers (
      id, type, name, base_url, model, dimension, api_key_encrypted,
      enabled, quality_tier, last_test_status, last_test_at, created_at, updated_at
    )
    values ('provider_perf', 'openai_compatible', 'Perf Provider', 'http://127.0.0.1:1/v1',
      'perf-embedding', 4, null, 1, 'basic', 'success', ?, ?, ?)
  `);
  const insertIndex = db.prepare(`
    insert into embedding_indexes (
      id, provider_id, model, dimension, distance_metric, table_name, status, created_at, updated_at
    )
    values ('index_perf', 'provider_perf', 'perf-embedding', 4, 'cosine',
      'vec_articles_index_perf', 'active', ?, ?)
  `);

  db.transaction(() => {
    for (let feed = 0; feed < feedCount; feed += 1) {
      insertFeed.run(
        `feed_${feed}`,
        `Performance Feed ${feed}`,
        `https://example.com/feed/${feed}.xml`,
        ((feed % 9) - 4) / 20,
        now,
        now
      );
      insertFeedStats.run(
        `feed_${feed}`,
        (feed % 11) / 20,
        (feed % 7) / 25,
        0.05 + (feed % 5) / 100,
        0.01 + (feed % 3) / 100,
        (feed % 4) / 100,
        now
      );
    }
    insertProvider.run(now, now, now);
    insertIndex.run(now, now);

    for (let article = 0; article < articleCount; article += 1) {
      const dailyOffset = Math.floor(article / 350);
      const timestamp = now - dailyOffset * 86_400_000 - (article % 350) * 1_000;
      const feedId = `feed_${article % feedCount}`;
      const articleId = `article_perf_${article}`;
      const contentHash = `hash_${article}_${timestamp}`;
      insertArticle.run(
        articleId,
        feedId,
        `guid_${article}`,
        `https://example.com/articles/${article}`,
        `https://example.com/articles/${article}`,
        `Performance article ${article}`,
        `Summary for performance article ${article}`,
        timestamp,
        timestamp,
        contentHash,
        `dedupe_${article}`,
        timestamp,
        timestamp
      );
      insertContent.run(
        articleId,
        `Full text for performance article ${article}. Topic ${article % 31}.`,
        timestamp,
        timestamp
      );

      const hiddenAt = article % 251 === 0 ? timestamp : null;
      const notInterestedAt = article % 313 === 0 ? timestamp : null;
      const progress = article % 17 === 0 ? 0.75 : article % 11 === 0 ? 0.5 : 0;
      insertState.run(
        articleId,
        article % 3 === 0 ? timestamp : null,
        article % 97 === 0 ? timestamp : null,
        article % 89 === 0 ? timestamp : null,
        hiddenAt,
        notInterestedAt,
        progress,
        article % 5 === 0 ? timestamp : null,
        timestamp
      );

      if (article % 5 === 0) {
        insertEvent.run(`event_open_${article}`, articleId, "open", 0.005, null, timestamp);
      }
      if (article % 17 === 0) {
        insertEvent.run(
          `event_progress_${article}`,
          articleId,
          "read_progress",
          0.04,
          JSON.stringify({ progress }),
          timestamp
        );
      }
      if (article % 97 === 0) {
        insertEvent.run(`event_favorite_${article}`, articleId, "favorite", 1, null, timestamp);
      }
      if (article % 313 === 0) {
        insertEvent.run(
          `event_not_interested_${article}`,
          articleId,
          "not_interested",
          -1,
          null,
          timestamp
        );
      }
    }
  })();

  const vectorStore = new SqliteVecVectorStore(db);
  vectorStore.ensureIndex("index_perf");
  db.transaction(() => {
    for (let article = 0; article < articleCount; article += 1) {
      vectorStore.upsertArticleVector({
        articleId: `article_perf_${article}`,
        embeddingIndexId: "index_perf",
        vector: vectorFor(article),
        contentHash: `hash_${article}_${now - Math.floor(article / 350) * 86_400_000 - (article % 350) * 1_000}`,
        now
      });
    }
  })();

  db.prepare(
    `
      update articles
      set content_hash = content_hash || ':stale'
      where cast(substr(id, length('article_perf_') + 1) as integer) < 100
    `
  ).run();

  db.prepare(
    `
      insert into interest_clusters (
        id, embedding_index_id, polarity, label, centroid_vector_blob,
        weight, sample_count, last_matched_at, created_at, updated_at
      )
      values
        ('cluster_perf_positive', 'index_perf', 'positive', null, ?, 4, 20, ?, ?, ?),
        ('cluster_perf_negative', 'index_perf', 'negative', null, ?, 2, 10, ?, ?, ?)
    `
  ).run(
    toVectorBlob([1, 0.2, 0.1, 0.05]),
    now,
    now,
    now,
    toVectorBlob([0.1, 1, 0.2, 0.05]),
    now,
    now,
    now
  );
}

function vectorFor(seed: number): number[] {
  return [
    1,
    (seed % 17) / 17,
    (seed % 31) / 31,
    (seed % 43) / 43
  ];
}

function measure(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

async function measureAsync(fn: () => Promise<void>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}
