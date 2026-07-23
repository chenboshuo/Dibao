/**
 * Issue 0009: Private network fetch error details dropped by API, no UI toggle
 *
 * Expected:
 * 1. userMessageForError() includes details.cause.message when present
 * 2. Settings UI has a toggle for "Allow private network feeds"
 *    (partially done — toggle exists but not wired to all services)
 *
 * Current: userMessageForError only returns `${code}: ${message}`.
 * The `details.cause` field with the actual fix instruction is dropped.
 */
import { describe, expect, it } from "vitest";
import { ApiRequestError, userMessageForError } from "./api.js";
import { dictionaries } from "./i18n.js";

describe("0009: Private network error display", () => {
  it("should include details.cause in userMessageForError output", () => {
    // Expected: When an ApiRequestError has a details.cause string,
    // userMessageForError appends it to the message.
    //
    // Current: userMessageForError returns `${code}: ${message}` only.
    // The `details.cause` from the API error chain is dropped.
    const error = new ApiRequestError(
      502,
      "PROVIDER_ERROR",
      "Fetch failed for feed: http://localhost:1200/rss.xml",
      {
        cause: "Attempted to fetch a private network resource without explicit permission."
      },
      true
    );

    const result = userMessageForError(error, dictionaries["en-US"].errors.api);

    expect(result).toContain("private network");
  });

  it("should surface PRIVATE_NETWORK_BLOCKED detail when available", () => {
    // Expected: The specific error detail about private network blocking
    // is preserved in the user-facing message.
    const error = new ApiRequestError(
      502,
      "PROVIDER_ERROR",
      "Fetch failed for feed: http://localhost:1200/rss.xml",
      {
        cause: {
          message: "Attempted to fetch a private network resource without explicit permission.",
          code: "PRIVATE_NETWORK_BLOCKED"
        }
      },
      true
    );

    const result = userMessageForError(error, dictionaries["en-US"].errors.api);

    expect(result).toContain("PRIVATE_NETWORK_BLOCKED");
  });
});
