import { describe, expect, it } from "vitest";
import { normalizeFeedUrl } from "./index.js";

describe("rss package", () => {
  it("normalizes feed URLs for storage", () => {
    expect(normalizeFeedUrl(" https://user:pass@example.com/feed.xml#top ")).toBe(
      "https://example.com/feed.xml"
    );
  });
});

