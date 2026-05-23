import type { FeedRepository, FeedRow } from "@dibao/db";

export type FeedHealthStatus =
  | "healthy"
  | "never_fetched"
  | "due"
  | "stale"
  | "failing"
  | "disabled";

export type FeedHealthSeverity = "ok" | "info" | "warning" | "error" | "disabled";

export type FeedHealthDiagnostic = {
  feedId: string;
  status: FeedHealthStatus;
  severity: FeedHealthSeverity;
  code: "OK" | "DISABLED" | "NEVER_FETCHED" | "DUE" | "STALE" | "FETCH_FAILED";
  message: string;
  lastFetchedAt: number | null;
  lastSuccessAt: number | null;
  nextRefreshAt: number | null;
  lastError: string | null;
};

export type FeedDiagnosticsResult = {
  summary: {
    total: number;
    enabled: number;
    healthy: number;
    warning: number;
    error: number;
    disabled: number;
    neverFetched: number;
  };
  items: Array<{
    feed: Pick<FeedRow, "id" | "title" | "feedUrl" | "siteUrl" | "enabled">;
    diagnostic: FeedHealthDiagnostic;
  }>;
};

export type FeedHealthServiceOptions = {
  feeds: Pick<FeedRepository, "list">;
  now?: () => number;
};

const staleAfterMs = 7 * 24 * 60 * 60 * 1000;

export class FeedHealthService {
  private readonly now: () => number;

  constructor(private readonly options: FeedHealthServiceOptions) {
    this.now = options.now ?? Date.now;
  }

  diagnostics(): FeedDiagnosticsResult {
    const now = this.now();
    const feeds = this.options.feeds.list();
    const items = feeds.map((feed) => ({
      feed: {
        id: feed.id,
        title: feed.title,
        feedUrl: feed.feedUrl,
        siteUrl: feed.siteUrl,
        enabled: feed.enabled
      },
      diagnostic: diagnoseFeed(feed, now)
    }));

    return {
      summary: summarize(items.map((item) => item.diagnostic), feeds),
      items
    };
  }
}

export function diagnoseFeed(feed: FeedRow, now: number): FeedHealthDiagnostic {
  const base = {
    feedId: feed.id,
    lastFetchedAt: feed.lastFetchedAt,
    lastSuccessAt: feed.lastSuccessAt,
    nextRefreshAt: feed.nextRefreshAt,
    lastError: feed.lastError
  };

  if (!feed.enabled) {
    return {
      ...base,
      status: "disabled",
      severity: "disabled",
      code: "DISABLED",
      message: "Feed is disabled."
    };
  }

  if (feed.lastError) {
    return {
      ...base,
      status: "failing",
      severity: "error",
      code: "FETCH_FAILED",
      message: "The latest feed fetch failed."
    };
  }

  if (feed.lastFetchedAt === null && feed.lastSuccessAt === null) {
    return {
      ...base,
      status: "never_fetched",
      severity: "info",
      code: "NEVER_FETCHED",
      message: "The feed has not been fetched yet."
    };
  }

  if (
    feed.lastSuccessAt !== null &&
    now - feed.lastSuccessAt > staleAfterMs &&
    feed.nextRefreshAt !== null &&
    feed.nextRefreshAt <= now
  ) {
    return {
      ...base,
      status: "stale",
      severity: "warning",
      code: "STALE",
      message: "The feed has not fetched successfully for more than 7 days."
    };
  }

  if (feed.nextRefreshAt !== null && feed.nextRefreshAt <= now) {
    return {
      ...base,
      status: "due",
      severity: "info",
      code: "DUE",
      message: "The feed is due for refresh."
    };
  }

  return {
    ...base,
    status: "healthy",
    severity: "ok",
    code: "OK",
    message: "Feed fetches are healthy."
  };
}

function summarize(
  diagnostics: FeedHealthDiagnostic[],
  feeds: FeedRow[]
): FeedDiagnosticsResult["summary"] {
  return {
    total: diagnostics.length,
    enabled: feeds.filter((feed) => feed.enabled).length,
    healthy: diagnostics.filter((diagnostic) => diagnostic.severity === "ok").length,
    warning: diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length,
    error: diagnostics.filter((diagnostic) => diagnostic.severity === "error").length,
    disabled: diagnostics.filter((diagnostic) => diagnostic.severity === "disabled").length,
    neverFetched: diagnostics.filter((diagnostic) => diagnostic.status === "never_fetched")
      .length
  };
}
