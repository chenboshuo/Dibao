import { createHash } from "node:crypto";
import {
  generateOpml,
  normalizeFeedUrl,
  OpmlParseError,
  parseOpml,
  type GenerateOpmlInput
} from "@dibao/rss";
import type {
  FeedFolderRepository,
  FeedFolderRow,
  FeedRepository,
  FeedRow
} from "@dibao/db";

export type OpmlImportResult = {
  foldersCreated: number;
  feedsCreated: number;
  feedsSkipped: number;
  errors: string[];
};

export class OpmlServiceError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "OpmlServiceError";
  }
}

export type OpmlServiceOptions = {
  folders: FeedFolderRepository;
  feeds: FeedRepository;
  now?: () => number;
};

export class OpmlService {
  private readonly now: () => number;

  constructor(private readonly options: OpmlServiceOptions) {
    this.now = options.now ?? Date.now;
  }

  importOpml(xml: string): OpmlImportResult {
    const parsed = parseOpmlText(xml);
    const now = this.now();
    const folderByTitle = new Map<string, FeedFolderRow>();
    const seenFeedUrls = new Set<string>();
    let foldersCreated = 0;
    let feedsCreated = 0;
    let feedsSkipped = 0;
    const errors: string[] = [];

    for (const folder of this.options.folders.list()) {
      folderByTitle.set(normalizeTitleKey(folder.title), folder);
    }

    for (const title of parsed.folders) {
      if (!folderByTitle.has(normalizeTitleKey(title))) {
        const folder = this.options.folders.upsert({
          id: folderIdForTitle(title),
          title,
          sortOrder: folderByTitle.size,
          now
        });
        folderByTitle.set(normalizeTitleKey(title), folder);
        foldersCreated += 1;
      }
    }

    for (const feed of parsed.feeds) {
      const normalizedFeedUrl = normalizeHttpUrl(feed.feedUrl);
      if (!normalizedFeedUrl) {
        feedsSkipped += 1;
        errors.push(`Invalid feed URL: ${feed.feedUrl}`);
        continue;
      }

      if (seenFeedUrls.has(normalizedFeedUrl) || this.options.feeds.findByFeedUrl(normalizedFeedUrl)) {
        seenFeedUrls.add(normalizedFeedUrl);
        feedsSkipped += 1;
        continue;
      }

      const folderResult = feed.folderTitle
        ? ensureFolder(feed.folderTitle, folderByTitle, this.options.folders, now)
        : null;
      if (folderResult?.created) {
        foldersCreated += 1;
      }

      this.options.feeds.upsert({
        id: feedIdForUrl(normalizedFeedUrl),
        folderId: folderResult?.folder.id ?? null,
        title: feed.title,
        siteUrl: normalizeOptionalHttpUrl(feed.siteUrl),
        feedUrl: normalizedFeedUrl,
        enabled: true,
        now
      });

      seenFeedUrls.add(normalizedFeedUrl);
      feedsCreated += 1;
    }

    return {
      foldersCreated,
      feedsCreated,
      feedsSkipped,
      errors
    };
  }

  exportOpml(): string {
    const folders = this.options.folders.list();
    const feeds = this.options.feeds.list();
    const exportedFolderIds = new Set(folders.map((folder) => folder.id));
    const feedsByFolderId = groupFeedsByFolderId(feeds);

    const input: GenerateOpmlInput = {
      title: "Dibao Subscriptions",
      folders: folders.map((folder) => ({
        title: folder.title,
        feeds: (feedsByFolderId.get(folder.id) ?? []).map(opmlFeedForRow)
      })),
      feeds: feeds
        .filter((feed) => feed.folderId === null || !exportedFolderIds.has(feed.folderId))
        .map(opmlFeedForRow)
    };

    return generateOpml(input);
  }
}

function parseOpmlText(xml: string) {
  try {
    return parseOpml(xml);
  } catch (error) {
    throw new OpmlServiceError(400, "VALIDATION_ERROR", "OPML parse failed", {
      cause: error instanceof OpmlParseError ? error.message : errorMessage(error)
    });
  }
}

function ensureFolder(
  title: string,
  folderByTitle: Map<string, FeedFolderRow>,
  folders: FeedFolderRepository,
  now: number
): { folder: FeedFolderRow; created: boolean } {
  const key = normalizeTitleKey(title);
  const existing = folderByTitle.get(key);
  if (existing) {
    return { folder: existing, created: false };
  }

  const folder = folders.upsert({
    id: folderIdForTitle(title),
    title,
    sortOrder: folderByTitle.size,
    now
  });
  folderByTitle.set(key, folder);
  return { folder, created: true };
}

function groupFeedsByFolderId(feeds: FeedRow[]): Map<string | null, FeedRow[]> {
  const grouped = new Map<string | null, FeedRow[]>();

  for (const feed of feeds) {
    const existing = grouped.get(feed.folderId) ?? [];
    existing.push(feed);
    grouped.set(feed.folderId, existing);
  }

  return grouped;
}

function opmlFeedForRow(feed: FeedRow) {
  return {
    title: feed.title,
    feedUrl: feed.feedUrl,
    siteUrl: feed.siteUrl
  };
}

function normalizeHttpUrl(value: string): string | null {
  try {
    const normalized = normalizeFeedUrl(value);
    const protocol = new URL(normalized).protocol;
    return protocol === "http:" || protocol === "https:" ? normalized : null;
  } catch {
    return null;
  }
}

function normalizeOptionalHttpUrl(value: string | null): string | null {
  return value ? normalizeHttpUrl(value) : null;
}

function normalizeTitleKey(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function feedIdForUrl(feedUrl: string): string {
  return `feed_${hashText(feedUrl).slice(0, 20)}`;
}

function folderIdForTitle(title: string): string {
  return `folder_${hashText(normalizeTitleKey(title)).slice(0, 20)}`;
}

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
