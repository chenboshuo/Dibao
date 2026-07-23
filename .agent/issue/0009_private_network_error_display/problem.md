# Problem: Private network fetch error details dropped by API, no UI toggle

## Summary

Two issues in the private-network / controlled-fetch error path:

1. When a feed is hosted on localhost (e.g., `http://localhost:1200/rss.xml`), `controlled-fetch.ts` blocks the request (default: `allowPrivateNetwork = false`). The error is returned with a `details.cause` field explaining this, but `userMessageForError()` in `api.ts` drops all fields except `message` and `code`. The user sees a generic "PROVIDER_ERROR" with no actionable detail.

2. The only way to allow private network fetches is via the `DIBAO_FETCH_ALLOW_PRIVATE=true` environment variable. There is no UI toggle in Settings.

## Evidence

**Error payload returned by API:**
```json
{
  "error": {
    "message": "Fetch failed for feed: http://localhost:1200/rss.xml",
    "code": "PROVIDER_ERROR",
    "statusCode": 502,
    "details": {
      "cause": {
        "message": "Attempted to fetch a private network resource without explicit permission. If you trust this source, set DIBAO_FETCH_ALLOW_PRIVATE=true",
        "code": "PRIVATE_NETWORK_BLOCKED"
      }
    }
  }
}
```

**What the user sees (after userMessageForError()):**
> "PROVIDER_ERROR: Fetch failed for feed: http://localhost:1200/rss.xml"

The `details.cause.message` with the actual fix instruction is dropped.

**Code path:**
```
api.ts: feedEndpoint.refreshFeed()
  → calls refreshFeedService.refreshFeed(feedId)
  → fetchAndParse() → controlled-fetch()
  → private IP blocked → throws with details.cause
  → catch in api.ts → userMessageForError()
  → userMessageForError() only returns `${code}: ${message}`
```

## Impact

- Users who self-host feeds on localhost cannot add them without setting environment variables
- The error message gives no hint about `DIBAO_FETCH_ALLOW_PRIVATE`
- Users must know to check logs or source code to resolve this

## Proposed fix

1. In `api.ts`: make `userMessageForError()` include `details.cause.message` when present
2. In Settings UI: add a toggle for "Allow private network feeds" that sets `DIBAO_FETCH_ALLOW_PRIVATE` (requires env var or persisted config)

## Code locations

- `apps/server/src/controlled-fetch.ts:356-357` — `allowPrivateNetwork` defaults to false
- `apps/server/src/api.ts` — `userMessageForError()` drops `details.cause`
- `apps/web/src/settings/SettingsWorkspace.tsx` — no private network toggle

## 2026-07-05 Update: Toggle exists but not fully wired

A Settings UI toggle (`Settings → Basics → Network → Allow private-network feeds`) has been added, and `FeedRefreshService` was wired to respect it. However, the toggle is **not** wired to other services that also call `controlledFetchText()`.

The user's repro hits **`FeedDiscoveryService`**, not `FeedRefreshService`:

```
POST /api/feeds/discover  {"url":"http://localhost:1200/telegram/channel/hatschannel"}
  → feedDiscoveryService.discover()
  → fetchText() → controlledFetchText(...)    ← no allowPrivateNetwork option passed
  → FETCH_PRIVATE_TARGET thrown
```

### Remaining work

| Task | Status |
|---|---|
| `userMessageForError()` fix | ✅ Done |
| Settings toggle + `AppSettings` type + i18n | ✅ Done |
| Wire `FeedRefreshService` (`feed-refresh-service.ts:129`) | ✅ Done |
| **Wire `FeedDiscoveryService` (`feed-discovery-service.ts:207`)** | ✅ **Fixed** — now reads `allowPrivateNetwork` from config |
| Wire `FullContentExtractionService` (`full-content-extraction-service.ts:48`) | ❌ |
| Wire `PluginService` (`plugin-service.ts:1945`) | ❌ |

### Tests added (`apps/server/src/app.test.ts`)

1. **✅ `enables private-network fetch via settings and verifies it persists`** — PATCH `/api/settings` with `fetch.allowPrivateNetwork: true` returns 200, verifies response body, and checks the row in `app_settings` table. Also verifies toggle back to `false`.

2. **✅ `unblocks localhost feed discovery when allowPrivateNetwork is enabled`** — Pre-seeds `fetch.settings` row in DB, builds server with a fixture fetcher mapping `http://localhost:1200/telegram/channel/hatschannel`, calls `POST /api/feeds/discover`. Expects 200 (not 502) with a valid response.

3. **✅ `blocks localhost feed discovery without allowPrivateNetwork`** — Same as above but without pre-seeding; expects 502 with "private-network" in response body.

All 3 tests pass alongside existing tests.
