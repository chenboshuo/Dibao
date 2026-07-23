# Problem: Feed fetchers lack User-Agent header

## Summary

Feed discovery and feed refresh services make outbound HTTP requests without a `User-Agent` header, causing some RSS feeds (particularly those behind CDNs like Akamai) to be unreachable.

## Evidence

**Affected code paths:**

- `apps/server/src/feed-discovery-service.ts:207-214` — `fetchText()` calls `controlledFetchText()` with only an `accept` header:
  ```typescript
  result = await controlledFetchText(url, {
    fetcher: this.fetcher,
    headers: {
      accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8"
    },
    ...
  });
  ```

- `apps/server/src/feed-refresh-service.ts:121-128` — `fetchAndParse()` has the same pattern:
  ```typescript
  result = await controlledFetchText(feedUrl, {
    fetcher: this.fetcher,
    headers: {
      accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8"
    },
    ...
  });
  ```

**Inconsistent with other outbound fetchers:**

- `apps/server/src/latest-release-service.ts:139` — sets `"user-agent": `dibao/${dibaoVersion}``
- `apps/server/src/full-content-extraction-service.ts:52` — sets `"user-agent": "DibaoFullContentFetcher/0.1"`
- `apps/server/src/plugin-service.ts:2053` — `fetchPluginText()` also calls `controlledFetchText` without a `user-agent` header (though its error message does include the HTTP status code)

**Error relay — discovery vs. refresh:**

Both services check `response.ok` after `controlledFetchText` returns. But they differ in how the status code is relayed:

- **Discovery** (`feed-discovery-service.ts:222-228`): uses `humanReadableError()` (line 353-359), which extracts the HTTP status from `error.details` and produces e.g. `"Input URL fetch failed: HTTP 403"`. So the caller **does** see the status code.
- **Refresh** (`feed-refresh-service.ts:136-138`): throws `FeedIngestionError("PROVIDER_ERROR", 502, "Feed fetch failed")` — no status code extracted. Worse, `feed-refresh-service.ts:112` calls `.recordFetchFailure(existing.id, error.message, ...)` which stores only this generic string, so the failure reason is lost to operators.

**`controlledFetchText` behavior:**

`controlledFetchText` (`controlled-fetch.ts:56-145`) never checks `response.ok`. It only rejects on timeout (`FETCH_TIMEOUT`), size exceed (`FETCH_TOO_LARGE`), private-network target (`FETCH_PRIVATE_TARGET`), too many redirects (`FETCH_READ_FAILED`), or read errors (`FETCH_READ_FAILED`). A 403 or 404 response is returned as a successful read, leaving the caller to decide how to handle it.

**Reproduction:**

Requesting discovery for `https://www.mdpi.com/rss/journal/behavsci` returns 403 from MDPI's Akamai CDN when fetched from this server. The direct URL is valid and accessible from browsers and curl on other machines.

## Impact

- Users cannot discover feeds from sites behind CDNs that enforce User-Agent checks (e.g., MDPI journals)
- The same issue affects background feed refresh — existing feeds behind such CDNs silently fail to update, and the failure reason is not recorded with the HTTP status
- `plugin-service.ts` has the same User-Agent gap, affecting plugin package fetches

## Expected

1. Feed fetchers should send a `User-Agent` header with a descriptive value (e.g., `DibaoFeedFetcher/0.1` or `dibao/${version}`), consistent with other outbound fetchers in the codebase
2. Feed refresh's error records should include the HTTP status code so operators can distinguish provider blocks from transient failures

## Context

This does not fix cases where a CDN blocks by IP range (e.g., Akamai WAF blocking server IPs) — that is an infrastructure concern. But setting a User-Agent is a best practice that resolves many User-Agent-based blocks and brings feed fetching in line with the rest of the codebase.
