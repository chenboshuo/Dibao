---
name: issue-0009-privated-network-fix
description: Fixed FeedDiscoveryService not respecting allowPrivateNetwork setting
metadata:
  type: project
---

Fixed issue#0009: `FeedDiscoveryService` was not passing `allowPrivateNetwork` to `controlledFetchText()`, so `POST /api/feeds/discover` with a localhost URL was blocked even after toggling the setting in UI. Root cause: the option was only wired to `FeedRefreshService`, but not to `FeedDiscoveryService`.

**What was done:**
1. Added `allowPrivateNetwork?: boolean` to `FeedDiscoveryServiceOptions`
2. Passed it through to `controlledFetchText()` call in `fetchText()` method
3. Wired it from `settingsService.getSettings().fetch.allowPrivateNetwork` in `app.ts`
4. Fixed type assertion in `userMessageForError()` (using `in` operator for narrowing `unknown` type)
5. Added 3 tests: settings toggle persistence, discover allowed with toggle, discover blocked without toggle
6. Fixed existing settings default assertion to include `fetch` key

**Still missing:** Same issue in `FullContentExtractionService` and `PluginService` — they also call `controlledFetchText()` without `allowPrivateNetwork`.

**Why:** The user hit this when trying to discover a feed at `http://localhost:1200/telegram/channel/hatschannel` — even after enabling the toggle in Settings, the discover endpoint still blocked it because `FeedDiscoveryService` wasn't wired.

**How to apply:** If a similar issue appears for full-content extraction or plugin fetches, wire `allowPrivateNetwork` through those services the same way.
