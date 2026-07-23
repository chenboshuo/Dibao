/**
 * Issue 0005: Enhanced full content fetch — configurable page format and fetch scope
 *
 * Expected:
 * 1. FullContentExtractionService accepts pageFormat ("formatted_html" | "plain_text" | "source_html")
 * 2. FullContentExtractionService accepts fetchScope ("article" | "metadata" | "full_page")
 * 3. Both can be set per-feed and globally in settings
 * 4. Default pageFormat is "formatted_html", default fetchScope is "article"
 *
 * Current: fullContentMode is a binary per-feed toggle ("feed_only" | "fetch_full_content").
 * No pageFormat or fetchScope options exist.
 */
import { describe, expect, it } from "vitest";
import { FullContentExtractionService } from "./full-content-extraction-service.js";

describe("0005: Full content enhancement — page format and fetch scope", () => {
  it("should accept pageFormat setting on FullContentExtractionService", () => {
    // Expected: FullContentExtractionService or its options type has
    // a `pageFormat` field that accepts "formatted_html" | "plain_text" | "source_html".
    //
    // Current: Only binary fullContentMode toggle exists.
    expect(false, [
      "pageFormat not implemented. FullContentExtractionService only knows",
      "fullContentMode: 'feed_only' | 'fetch_full_content'.",
      "See feed-refresh-service.ts:177, feed-full-content-service.ts:66"
    ].join(" ")).toBe(true);
  });

  it("should accept fetchScope setting", () => {
    // Expected: A fetchScope option that controls extraction range:
    // "article" (default), "metadata" (article + author/date), "full_page" (visible text)
    expect(false, [
      "fetchScope not implemented. The extraction chain is hardcoded:",
      "<article> → role=\"main\" → <main> → content-classed div → <body>",
      "Expected: configurable scope setting."
    ].join(" ")).toBe(true);
  });

  it("should support global default pageFormat and fetchScope in AppSettings", () => {
    // Expected: Settings have global defaults for pageFormat and fetchScope
    // that can be overridden per-feed, similar to fullContentMode.
    expect(false, [
      "Global defaults for pageFormat/fetchScope not implemented.",
      "Expected: settings fields for content extraction preferences."
    ].join(" ")).toBe(true);
  });
});
