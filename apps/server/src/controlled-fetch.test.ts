import { describe, expect, it, vi } from "vitest";
import {
  ControlledFetchError,
  controlledFetchText,
  type FetchPrivacyWarning
} from "./controlled-fetch.js";

describe("controlledFetchText", () => {
  it("reads normal text responses", async () => {
    const result = await controlledFetchText("https://example.com/feed.xml", {
      fetcher: async () => new Response("hello"),
      maxBytes: 100
    });

    expect(result.body).toBe("hello");
    expect(result.response.ok).toBe(true);
  });

  it("fails before reading when content-length exceeds the byte limit", async () => {
    await expect(
      controlledFetchText("https://example.com/large.xml", {
        fetcher: async () =>
          new Response("small", {
            headers: {
              "content-length": "101"
            }
          }),
        maxBytes: 100
      })
    ).rejects.toMatchObject({
      code: "FETCH_TOO_LARGE"
    } satisfies Partial<ControlledFetchError>);
  });

  it("fails while streaming when the body exceeds the byte limit", async () => {
    await expect(
      controlledFetchText("https://example.com/large.xml", {
        fetcher: async () => new Response("x".repeat(101)),
        maxBytes: 100
      })
    ).rejects.toMatchObject({
      code: "FETCH_TOO_LARGE"
    } satisfies Partial<ControlledFetchError>);
  });

  it("times out slow fetches", async () => {
    await expect(
      controlledFetchText("https://example.com/slow.xml", {
        fetcher: () => new Promise<Response>(() => undefined),
        timeoutMs: 1,
        maxBytes: 100
      })
    ).rejects.toMatchObject({
      code: "FETCH_TIMEOUT"
    } satisfies Partial<ControlledFetchError>);
  });

  it("warns but does not block private targets and redirected private targets", async () => {
    const warnings: FetchPrivacyWarning[] = [];
    const redirected = new Response("ok");
    Object.defineProperty(redirected, "url", {
      value: "http://127.0.0.1/final",
      configurable: true
    });

    const result = await controlledFetchText("http://192.168.1.2/feed.xml", {
      fetcher: async () => redirected,
      maxBytes: 100,
      onWarning: (warning) => warnings.push(warning)
    });

    expect(result.body).toBe("ok");
    expect(warnings).toMatchObject([
      { hostname: "192.168.1.2", reason: "private-ipv4" },
      { hostname: "127.0.0.1", reason: "private-ipv4" }
    ]);
  });

  it("passes timeout abort signals to the fetcher", async () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response("ok");
    });

    await controlledFetchText("https://example.com/feed.xml", {
      fetcher,
      timeoutMs: 100,
      maxBytes: 100
    });

    expect(fetcher).toHaveBeenCalledOnce();
  });
});
