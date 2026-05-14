import type Database from "better-sqlite3";

export type DibaoDatabase = Database.Database;

export type Migration = {
  version: string;
  name: string;
  sql: string;
  checksum?: string;
};

export type AppliedMigration = {
  version: string;
  name: string;
  appliedAt: number;
  checksum: string | null;
};

export type FeedRow = {
  id: string;
  folderId: string | null;
  title: string;
  siteUrl: string | null;
  feedUrl: string;
  description: string | null;
  enabled: boolean;
  sourceWeight: number;
  lastFetchedAt: number | null;
  lastSuccessAt: number | null;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
};

export type UpsertFeedInput = {
  id: string;
  folderId?: string | null;
  title: string;
  siteUrl?: string | null;
  feedUrl: string;
  description?: string | null;
  enabled?: boolean;
  sourceWeight?: number;
  now?: number;
};

export type ArticleRow = {
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
  status: "active" | "archived" | "deleted";
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
};

export type UpsertArticleInput = {
  id: string;
  feedId: string;
  guid?: string | null;
  url: string;
  canonicalUrl?: string | null;
  title: string;
  author?: string | null;
  summary?: string | null;
  publishedAt?: number | null;
  discoveredAt?: number;
  contentHash?: string | null;
  dedupeKey: string;
  status?: ArticleRow["status"];
  now?: number;
};

export type UpsertArticleContentInput = {
  articleId: string;
  contentHtml?: string | null;
  contentText?: string | null;
  extractionStatus?: "pending" | "feed_only" | "success" | "failed" | "skipped";
  extractionError?: string | null;
  extractedAt?: number | null;
  now?: number;
};

export type ArticleSearchResult = {
  articleId: string;
  title: string;
  summary: string | null;
  rank: number;
};

export type EmbeddingProviderInput = {
  id: string;
  type: "embedded_local" | "ollama" | "openai_compatible" | "custom_http";
  name: string;
  baseUrl?: string | null;
  model: string;
  dimension: number;
  apiKeyEncrypted?: string | null;
  enabled?: boolean;
  qualityTier?: "basic" | "recommended" | "best_quality";
  now?: number;
};

export type EmbeddingIndexInput = {
  id: string;
  providerId: string;
  model: string;
  dimension: number;
  distanceMetric?: "cosine";
  tableName: string;
  status?: "active" | "building" | "disabled" | "failed" | "retired";
  now?: number;
};

export type EmbeddingIndexRow = {
  id: string;
  providerId: string;
  model: string;
  dimension: number;
  distanceMetric: "cosine";
  tableName: string;
  status: "active" | "building" | "disabled" | "failed" | "retired";
};

export type ArticleVectorInput = {
  articleId: string;
  embeddingIndexId: string;
  vector: Buffer | readonly number[];
  contentHash: string;
  now?: number;
};

export type SimilarArticleQuery = {
  embeddingIndexId: string;
  vector: Buffer | readonly number[];
  limit?: number;
};

export type VectorSearchResult = {
  articleId: string;
  distance: number;
};
