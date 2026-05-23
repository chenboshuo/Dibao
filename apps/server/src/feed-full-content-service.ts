import type { FeedRepository } from "@dibao/db";
import { FeedIngestionError, FeedRefreshService } from "./feed-refresh-service.js";
import type {
  FullContentExtractionResult,
  FullContentExtractionService
} from "./full-content-extraction-service.js";

export const MAX_FULL_CONTENT_BACKFILL_ITEMS = 50;

export type FullContentPreviewResponse = FullContentExtractionResult & {
  feedId: string;
};

export type FullContentBackfillResult = {
  feedId: string;
  articlesSeen: number;
  attempted: number;
  succeeded: number;
  failed: number;
  skipped: number;
  articleIds: string[];
  effectiveContentChangedArticleIds: string[];
  limited: boolean;
};

export class FeedFullContentService {
  constructor(
    private readonly options: {
      feeds: FeedRepository;
      refreshService: Pick<FeedRefreshService, "fetchAndParse" | "writeParsedFeed">;
      extractor: Pick<FullContentExtractionService, "preview">;
    }
  ) {}

  async previewFeedFullContent(input: {
    feedId: string;
    articleUrl?: string;
  }): Promise<FullContentPreviewResponse> {
    const feed = this.options.feeds.findById(input.feedId);
    if (!feed) {
      throw new FeedIngestionError("NOT_FOUND", 404, "Feed not found");
    }

    let articleUrl = input.articleUrl?.trim();
    if (!articleUrl) {
      const parsed = await this.options.refreshService.fetchAndParse(feed.feedUrl);
      articleUrl = parsed.items.find((item) => item.url.trim())?.url;
    }

    if (!articleUrl) {
      throw new FeedIngestionError("VALIDATION_ERROR", 409, "Current feed has no article URL");
    }

    const result = await this.options.extractor.preview(articleUrl);
    return {
      feedId: feed.id,
      ...result
    };
  }

  async backfillCurrentFeedFullContent(feedId: string): Promise<FullContentBackfillResult> {
    const feed = this.options.feeds.findById(feedId);
    if (!feed) {
      throw new FeedIngestionError("NOT_FOUND", 404, "Feed not found");
    }
    if (feed.fullContentMode !== "fetch_full_content") {
      throw new FeedIngestionError(
        "CONFLICT",
        409,
        "Enable full content fetching for this feed before backfilling current items"
      );
    }

    const parsed = await this.options.refreshService.fetchAndParse(feed.feedUrl);
    const limited = parsed.items.length > MAX_FULL_CONTENT_BACKFILL_ITEMS;
    const result = await this.options.refreshService.writeParsedFeed({
      feedId: feed.id,
      feedUrl: feed.feedUrl,
      folderId: feed.folderId,
      parsed: {
        ...parsed,
        items: parsed.items.slice(0, MAX_FULL_CONTENT_BACKFILL_ITEMS)
      }
    });

    return {
      feedId: feed.id,
      articlesSeen: parsed.items.length,
      attempted: result.fullContent.attempted,
      succeeded: result.fullContent.succeeded,
      failed: result.fullContent.failed,
      skipped: result.fullContent.skipped,
      articleIds: result.articleIds,
      effectiveContentChangedArticleIds: result.effectiveContentChangedArticleIds,
      limited
    };
  }
}
