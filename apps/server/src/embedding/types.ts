import type { EmbeddingProviderRow } from "@dibao/db";

export type EmbeddingProviderConfig = Pick<
  EmbeddingProviderRow,
  "id" | "type" | "name" | "baseUrl" | "model" | "dimension"
> & {
  apiKey: string | null;
};

export type EmbeddingInput = {
  id: string;
  text: string;
};

export type EmbeddingVector = {
  id: string;
  vector: number[];
};

export type EmbeddingTestResult = {
  dimension: number;
  latencyMs: number;
};

export interface EmbeddingProviderAdapter {
  embedBatch(input: {
    provider: EmbeddingProviderConfig;
    items: EmbeddingInput[];
  }): Promise<EmbeddingVector[]>;
  test(provider: EmbeddingProviderConfig): Promise<EmbeddingTestResult>;
}

export class EmbeddingProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "EmbeddingProviderError";
  }
}
