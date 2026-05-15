import { describe, expect, it } from "vitest";
import { ApiRequestError, createDibaoApi, userMessageForError } from "./api.js";
import { dictionaries } from "./i18n.js";

describe("web API client", () => {
  it("posts article actions using the contract-shaped body", async () => {
    const calls: Array<{ path: string; body: unknown; method: string | undefined }> = [];
    const api = createDibaoApi(async (input, init) => {
      calls.push({
        path: String(input),
        body: init?.body ? JSON.parse(String(init.body)) : null,
        method: init?.method
      });

      return new Response(
        JSON.stringify({
          data: {
            state: {
              read: false,
              favorited: false,
              readLater: false,
              hidden: false,
              notInterested: false,
              readingProgress: 0
            }
          }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    });

    await api.postArticleAction("article/one", {
      type: "favorite",
      value: false
    });
    await api.postArticleAction("article/one", {
      type: "read_progress",
      progress: 0.5
    });

    expect(calls).toEqual([
      {
        path: "/api/articles/article%2Fone/actions",
        method: "POST",
        body: {
          type: "favorite",
          value: false
        }
      },
      {
        path: "/api/articles/article%2Fone/actions",
        method: "POST",
        body: {
          type: "read_progress",
          progress: 0.5
        }
      }
    ]);
  });

  it("parses contract-shaped errors", async () => {
    const api = createDibaoApi(async () =>
      new Response(
        JSON.stringify({
          error: {
            code: "PROVIDER_ERROR",
            message: "Feed parse failed"
          }
        }),
        {
          status: 502,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );

    await expect(api.createFeed("https://example.com/feed.xml")).rejects.toMatchObject({
      status: 502,
      code: "PROVIDER_ERROR",
      message: "Feed parse failed"
    });
  });

  it("returns a stable user-facing error message", () => {
    expect(
      userMessageForError(
        new ApiRequestError(400, "VALIDATION_ERROR", "Invalid URL"),
        dictionaries["zh-CN"].errors.api
      )
    ).toBe("Invalid URL");
    expect(userMessageForError("nope", dictionaries["zh-CN"].errors.api)).toBe(
      dictionaries["zh-CN"].errors.api.requestFailed
    );
    expect(
      userMessageForError(
        new ApiRequestError(500, "INTERNAL_ERROR", "", undefined, false),
        dictionaries["en-US"].errors.api
      )
    ).toBe("Request failed (HTTP 500).");
  });
});
