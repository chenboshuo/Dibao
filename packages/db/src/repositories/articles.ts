import { SqliteArticleFtsIndex } from "../fts/article-fts.js";
import type {
  ArticleRow,
  DibaoDatabase,
  UpsertArticleContentInput,
  UpsertArticleInput
} from "../types.js";

type ArticleDbRow = {
  id: string;
  feedId: string;
  guid: string | null;
  url: string;
  canonicalUrl: string | null;
  title: string;
  author: string | null;
  summary: string | null;
  publishedAt: number | null;
  discoveredAt: number;
  contentHash: string | null;
  dedupeKey: string;
  status: ArticleRow["status"];
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
};

export interface ArticleRepository {
  findById(id: string): ArticleRow | null;
  upsert(input: UpsertArticleInput): ArticleRow;
  upsertContent(input: UpsertArticleContentInput): void;
}

export class SqliteArticleRepository implements ArticleRepository {
  private readonly fts: SqliteArticleFtsIndex;

  constructor(private readonly db: DibaoDatabase) {
    this.fts = new SqliteArticleFtsIndex(db);
  }

  findById(id: string): ArticleRow | null {
    const row = this.db
      .prepare(
        `
          ${baseArticleSelect()}
          where id = ?
        `
      )
      .get(id) as ArticleDbRow | undefined;
    return row ? mapArticle(row) : null;
  }

  upsert(input: UpsertArticleInput): ArticleRow {
    const now = input.now ?? Date.now();
    const discoveredAt = input.discoveredAt ?? now;

    this.db
      .prepare(
        `
          insert into articles (
            id,
            feed_id,
            guid,
            url,
            canonical_url,
            title,
            author,
            summary,
            published_at,
            discovered_at,
            content_hash,
            dedupe_key,
            status,
            created_at,
            updated_at
          )
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          on conflict(id) do update set
            feed_id = excluded.feed_id,
            guid = excluded.guid,
            url = excluded.url,
            canonical_url = excluded.canonical_url,
            title = excluded.title,
            author = excluded.author,
            summary = excluded.summary,
            published_at = excluded.published_at,
            content_hash = excluded.content_hash,
            dedupe_key = excluded.dedupe_key,
            status = excluded.status,
            updated_at = excluded.updated_at
        `
      )
      .run(
        input.id,
        input.feedId,
        input.guid ?? null,
        input.url,
        input.canonicalUrl ?? null,
        input.title,
        input.author ?? null,
        input.summary ?? null,
        input.publishedAt ?? null,
        discoveredAt,
        input.contentHash ?? null,
        input.dedupeKey,
        input.status ?? "active",
        now,
        now
      );

    this.syncFts(input.id);

    const row = this.findById(input.id);
    if (!row) {
      throw new Error(`Failed to upsert article: ${input.id}`);
    }
    return row;
  }

  upsertContent(input: UpsertArticleContentInput): void {
    const now = input.now ?? Date.now();
    this.db
      .prepare(
        `
          insert into article_contents (
            article_id,
            content_html,
            content_text,
            extraction_status,
            extraction_error,
            extracted_at,
            updated_at
          )
          values (?, ?, ?, ?, ?, ?, ?)
          on conflict(article_id) do update set
            content_html = excluded.content_html,
            content_text = excluded.content_text,
            extraction_status = excluded.extraction_status,
            extraction_error = excluded.extraction_error,
            extracted_at = excluded.extracted_at,
            updated_at = excluded.updated_at
        `
      )
      .run(
        input.articleId,
        input.contentHtml ?? null,
        input.contentText ?? null,
        input.extractionStatus ?? "pending",
        input.extractionError ?? null,
        input.extractedAt ?? null,
        now
      );

    this.syncFts(input.articleId);
  }

  private syncFts(articleId: string): void {
    const row = this.db
      .prepare(
        `
          select
            a.id as articleId,
            a.title,
            a.summary,
            ac.content_text as contentText
          from articles a
          left join article_contents ac on ac.article_id = a.id
          where a.id = ? and a.deleted_at is null
        `
      )
      .get(articleId) as
      | {
          articleId: string;
          title: string;
          summary: string | null;
          contentText: string | null;
        }
      | undefined;

    if (!row) {
      this.fts.delete(articleId);
      return;
    }

    this.fts.upsert(row);
  }
}

function baseArticleSelect(): string {
  return `
    select
      id,
      feed_id as feedId,
      guid,
      url,
      canonical_url as canonicalUrl,
      title,
      author,
      summary,
      published_at as publishedAt,
      discovered_at as discoveredAt,
      content_hash as contentHash,
      dedupe_key as dedupeKey,
      status,
      created_at as createdAt,
      updated_at as updatedAt,
      deleted_at as deletedAt
    from articles
  `;
}

function mapArticle(row: ArticleDbRow): ArticleRow {
  return row;
}
