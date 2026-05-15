import { randomBytes } from "node:crypto";
import type { EmbeddingRepository, JobRepository, JobRow, VectorStore } from "@dibao/db";
import { PermanentJobFailure } from "./job-runner.js";

export const VECTOR_INDEX_REBUILD_JOB_TYPE = "vector_index_rebuild" as const;

export type VectorIndexRebuildJobPayload = {
  embeddingIndexId: string;
};

export type VectorIndexRebuildJobServiceOptions = {
  embeddings: Pick<EmbeddingRepository, "findIndexById" | "markIndexStatus">;
  jobs: Pick<JobRepository, "enqueue" | "listOpenByType">;
  vectorStore: Pick<VectorStore, "rebuildIndex">;
  now?: () => number;
  jobIdFactory?: () => string;
};

export class VectorIndexRebuildJobService {
  private readonly now: () => number;
  private readonly jobIdFactory: () => string;

  constructor(private readonly options: VectorIndexRebuildJobServiceOptions) {
    this.now = options.now ?? Date.now;
    this.jobIdFactory = options.jobIdFactory ?? randomJobId;
  }

  enqueueRebuildIndex(embeddingIndexId: string): JobRow {
    const index = this.options.embeddings.findIndexById(embeddingIndexId);
    if (!index) {
      throw new PermanentJobFailure("Embedding index not found");
    }

    const existing = this.options.jobs
      .listOpenByType(VECTOR_INDEX_REBUILD_JOB_TYPE)
      .find(
        (job) => parseVectorIndexRebuildPayload(job.payloadJson)?.embeddingIndexId === embeddingIndexId
      );

    if (existing) {
      return existing;
    }

    const now = this.now();
    return this.options.jobs.enqueue({
      id: this.jobIdFactory(),
      type: VECTOR_INDEX_REBUILD_JOB_TYPE,
      payloadJson: JSON.stringify({ embeddingIndexId } satisfies VectorIndexRebuildJobPayload),
      maxAttempts: 3,
      runAfter: now,
      now
    });
  }

  async handleVectorIndexRebuildJob(job: JobRow): Promise<void> {
    const payload = parseVectorIndexRebuildPayload(job.payloadJson);
    if (!payload) {
      throw new PermanentJobFailure("Invalid vector_index_rebuild job payload");
    }

    const index = this.options.embeddings.findIndexById(payload.embeddingIndexId);
    if (!index) {
      throw new PermanentJobFailure("Embedding index not found");
    }

    this.options.embeddings.markIndexStatus(index.id, "building", this.now());

    try {
      this.options.vectorStore.rebuildIndex(index.id);
      this.options.embeddings.markIndexStatus(index.id, "active", this.now());
    } catch (error) {
      this.options.embeddings.markIndexStatus(index.id, "failed", this.now());
      throw error;
    }
  }
}

export function parseVectorIndexRebuildPayload(
  payloadJson: string | null
): VectorIndexRebuildJobPayload | null {
  if (!payloadJson) {
    return null;
  }

  try {
    const payload = JSON.parse(payloadJson) as unknown;
    if (
      typeof payload === "object" &&
      payload !== null &&
      !Array.isArray(payload) &&
      Object.keys(payload).length === 1 &&
      typeof (payload as { embeddingIndexId?: unknown }).embeddingIndexId === "string" &&
      (payload as { embeddingIndexId: string }).embeddingIndexId.trim() !== ""
    ) {
      return {
        embeddingIndexId: (payload as { embeddingIndexId: string }).embeddingIndexId
      };
    }
  } catch {
    return null;
  }

  return null;
}

function randomJobId(): string {
  return `job_${randomBytes(10).toString("hex")}`;
}
