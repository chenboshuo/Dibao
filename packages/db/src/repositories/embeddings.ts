import type {
  DibaoDatabase,
  EmbeddingIndexInput,
  EmbeddingIndexRow,
  EmbeddingProviderInput
} from "../types.js";
import { safeVecTableName } from "../vector/sqlite-vec-vector-store.js";

export interface EmbeddingRepository {
  upsertProvider(input: EmbeddingProviderInput): void;
  createIndex(input: Omit<EmbeddingIndexInput, "tableName"> & { tableName?: string }): EmbeddingIndexRow;
  findIndexById(id: string): EmbeddingIndexRow | null;
}

export class SqliteEmbeddingRepository implements EmbeddingRepository {
  constructor(private readonly db: DibaoDatabase) {}

  upsertProvider(input: EmbeddingProviderInput): void {
    const now = input.now ?? Date.now();

    this.db
      .prepare(
        `
          insert into embedding_providers (
            id,
            type,
            name,
            base_url,
            model,
            dimension,
            api_key_encrypted,
            enabled,
            quality_tier,
            created_at,
            updated_at
          )
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          on conflict(id) do update set
            type = excluded.type,
            name = excluded.name,
            base_url = excluded.base_url,
            model = excluded.model,
            dimension = excluded.dimension,
            api_key_encrypted = excluded.api_key_encrypted,
            enabled = excluded.enabled,
            quality_tier = excluded.quality_tier,
            updated_at = excluded.updated_at
        `
      )
      .run(
        input.id,
        input.type,
        input.name,
        input.baseUrl ?? null,
        input.model,
        input.dimension,
        input.apiKeyEncrypted ?? null,
        input.enabled ? 1 : 0,
        input.qualityTier ?? "basic",
        now,
        now
      );
  }

  createIndex(
    input: Omit<EmbeddingIndexInput, "tableName"> & { tableName?: string }
  ): EmbeddingIndexRow {
    const now = input.now ?? Date.now();
    const tableName = input.tableName ?? safeVecTableName(input.id);

    this.db
      .prepare(
        `
          insert into embedding_indexes (
            id,
            provider_id,
            model,
            dimension,
            distance_metric,
            table_name,
            status,
            created_at,
            updated_at
          )
          values (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        input.id,
        input.providerId,
        input.model,
        input.dimension,
        input.distanceMetric ?? "cosine",
        tableName,
        input.status ?? "active",
        now,
        now
      );

    const index = this.findIndexById(input.id);
    if (!index) {
      throw new Error(`Failed to create embedding index: ${input.id}`);
    }
    return index;
  }

  findIndexById(id: string): EmbeddingIndexRow | null {
    const row = this.db
      .prepare(
        `
          select
            id,
            provider_id as providerId,
            model,
            dimension,
            distance_metric as distanceMetric,
            table_name as tableName,
            status
          from embedding_indexes
          where id = ?
        `
      )
      .get(id) as EmbeddingIndexRow | undefined;

    return row ?? null;
  }
}
