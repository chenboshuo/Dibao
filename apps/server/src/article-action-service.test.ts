import { describe, expect, it } from "vitest";
import type {
  ArticleActionRepository,
  ArticleActionType,
  RecordArticleActionInput,
  RecordArticleActionResult
} from "@dibao/db";
import { ArticleActionService } from "./article-action-service.js";

describe("ArticleActionService", () => {
  it("keeps high-volume weak actions to article-level ranking jobs", () => {
    const calls = createRankingCallRecorder();
    const service = new ArticleActionService({
      actions: fixedActionRepository(),
      profile: {
        processEvent: () => ({
          articleIds: ["article_1"],
          feedStatsChanged: true,
          profileChanged: false
        })
      },
      rankingJobs: calls
    });

    for (const type of ["impression", "open", "read_progress"] satisfies ArticleActionType[]) {
      service.record({ articleId: "article_1", type });
    }

    expect(calls.enqueueAllCount).toBe(0);
    expect(calls.articleJobs).toEqual([["article_1"], ["article_1"], ["article_1"]]);
  });

  it("uses full ranking jobs for clear profile or source preference changes", () => {
    const profileChangedCalls = createRankingCallRecorder();
    new ArticleActionService({
      actions: fixedActionRepository(),
      profile: {
        processEvent: () => ({
          articleIds: ["article_1"],
          feedStatsChanged: true,
          profileChanged: true
        })
      },
      rankingJobs: profileChangedCalls
    }).record({ articleId: "article_1", type: "favorite" });

    expect(profileChangedCalls.enqueueAllCount).toBe(1);
    expect(profileChangedCalls.articleJobs).toEqual([]);

    const sourceChangedCalls = createRankingCallRecorder();
    new ArticleActionService({
      actions: fixedActionRepository(),
      profile: {
        processEvent: () => ({
          articleIds: ["article_1"],
          feedStatsChanged: true,
          profileChanged: false
        })
      },
      rankingJobs: sourceChangedCalls
    }).record({ articleId: "article_1", type: "favorite" });

    expect(sourceChangedCalls.enqueueAllCount).toBe(1);
    expect(sourceChangedCalls.articleJobs).toEqual([]);
  });

  it("can clear read-later state after a read-complete progress event without recording a new action", () => {
    const service = new ArticleActionService({
      actions: fixedActionRepository({
        readLater: true,
        clearReadLaterState: true
      }),
      removeReadLaterOnReadComplete: () => true
    });

    const result = service.record({
      articleId: "article_1",
      type: "read_progress",
      progress: 0.9
    });

    expect(result.eventId).toBe("event_read_progress");
    expect(result.state).toMatchObject({
      readLater: false,
      readingProgress: 0.9,
      interactionStatus: "read"
    });
  });
});

function fixedActionRepository(
  options: {
    readLater?: boolean;
    clearReadLaterState?: boolean;
  } = {}
): ArticleActionRepository {
  return {
    clearReadLater(_articleId: string): RecordArticleActionResult["state"] {
      return {
        read: false,
        favorited: false,
        liked: false,
        readLater: !options.clearReadLaterState,
        hidden: false,
        notInterested: false,
        readingProgress: 0.9,
        interactionStatus: "read",
        openedAt: null,
        ignoredAt: null
      };
    },
    record(input: RecordArticleActionInput): RecordArticleActionResult {
      return {
        eventId: `event_${input.type}`,
        state: {
          read: false,
          favorited: false,
          liked: false,
          readLater: options.readLater ?? false,
          hidden: false,
          notInterested: false,
          readingProgress: input.progress ?? 0,
          interactionStatus:
            input.type === "read_progress" && (input.progress ?? 0) >= 0.9
              ? "read"
              : input.type === "impression"
                ? "ignored"
                : "opened",
          openedAt: input.type === "open" ? input.now ?? 1000 : null,
          ignoredAt: input.type === "impression" ? input.now ?? 1000 : null
        }
      };
    }
  };
}

function createRankingCallRecorder() {
  return {
    enqueueAllCount: 0,
    articleJobs: [] as string[][],
    enqueueAll() {
      this.enqueueAllCount += 1;
      return {} as never;
    },
    enqueueArticles(articleIds: string[]) {
      this.articleJobs.push(articleIds);
      return {} as never;
    }
  };
}
