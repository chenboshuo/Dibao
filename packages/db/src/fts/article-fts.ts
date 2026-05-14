import type { ArticleSearchResult, DibaoDatabase } from "../types.js";

export interface ArticleFtsIndex {
  upsert(input: {
    articleId: string;
    title: string;
    summary?: string | null;
    contentText?: string | null;
  }): void;
  delete(articleId: string): void;
  search(query: string, limit?: number): ArticleSearchResult[];
}

export class SqliteArticleFtsIndex implements ArticleFtsIndex {
  constructor(private readonly db: DibaoDatabase) {}

  upsert(input: {
    articleId: string;
    title: string;
    summary?: string | null;
    contentText?: string | null;
  }): void {
    this.db.transaction(() => {
      this.delete(input.articleId);
      this.db
        .prepare(
          `
            insert into article_fts (article_id, title, summary, content_text)
            values (?, ?, ?, ?)
          `
        )
        .run(
          input.articleId,
          input.title,
          input.summary ?? "",
          input.contentText ?? ""
        );
    })();
  }

  delete(articleId: string): void {
    this.db.prepare("delete from article_fts where article_id = ?").run(articleId);
  }

  search(query: string, limit: number = 50): ArticleSearchResult[] {
    return this.db
      .prepare(
        `
          select
            article_id as articleId,
            title,
            nullif(summary, '') as summary,
            rank
          from article_fts
          where article_fts match ?
          order by rank
          limit ?
        `
      )
      .all(query, limit) as ArticleSearchResult[];
  }
}
