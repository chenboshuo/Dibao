export const dibaoVersion = "0.1.0";

export type ApiSuccess<T> = {
  data: T;
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ArticleState = {
  read: boolean;
  favorited: boolean;
  readLater: boolean;
  hidden: boolean;
  notInterested: boolean;
  readingProgress: number;
};

export type RankReasonImpact = "positive" | "negative" | "neutral";

export type RankReason = {
  type:
    | "positive_cluster"
    | "negative_cluster"
    | "source"
    | "freshness"
    | "duplicate"
    | "state"
    | "fallback";
  label: string;
  impact: RankReasonImpact;
};
