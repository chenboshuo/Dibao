# Plan: Fix private-network error display and add settings UI toggle

## Overview

Two independent tasks:

1. **Fix `userMessageForError()`** to surface the `details.cause` message so users see actionable guidance when a private-network feed is blocked.
2. **Add a UI toggle** in Settings → Basics to allow private-network fetches, plumbing the value from the settings page down to `controlled-fetch.ts`.

---

## Task 1 — Surface `details.cause` in error messages

### Problem

`userMessageForError()` in `apps/web/src/api.ts` returns only `error.message` for `ApiRequestError` instances that have `hasUserMessage === true`. The `error.details.cause` field—which contains the actual explanation and fix instruction—is entirely dropped.

### Error data flow

```
controlled-fetch.ts:266  → throws ControlledFetchError("FETCH_PRIVATE_TARGET", "Fetch target is blocked…")
feed-refresh-service.ts:130 → wraps as FeedIngestionError("PROVIDER_ERROR", 502, "Feed fetch failed", { cause: errorMessage(caught) })
app.ts:6452  → sendApiError(reply, 502, "PROVIDER_ERROR", "Feed fetch failed", { cause: "Fetch target is blocked…" })
api.ts:1200   → new ApiRequestError(502, "PROVIDER_ERROR", "Feed fetch failed", { cause: "Fetch target is blocked…" }, true)
api.ts:2188-2197 → userMessageForError() returns "Feed fetch failed" — details.cause dropped
```

### Fix: `apps/web/src/api.ts`

Change `userMessageForError()` to append `details.cause` when it is a non-empty string.

```typescript
export function userMessageForError(error: unknown, messages: ApiErrorMessages): string {
  if (error instanceof ApiRequestError) {
    if (error.code === "DATABASE_BUSY") {
      return messages.databaseBusy;
    }
    const base = error.hasUserMessage && error.message ? error.message : messages.httpError(error.status);
    const detailsCause = error.details && typeof error.details === "object" && "cause" in error.details ? (error.details as { cause: unknown }).cause : undefined;
    if (typeof detailsCause === "string" && detailsCause.length > 0) {
      return `${base}\n${detailsCause}`;
    }
    return base;
  }
  return messages.requestFailed;
}
```

This is sufficient because:
- The server already passes `details.cause` through the entire chain (a string from `errorMessage()`).
- The `ApiRequestError` constructor stores it in `this.details`.
- No server-side changes needed.

---

## Task 2 — Add Allow-Private-Network toggle in Settings

### Overview

Add a `fetch.allowPrivateNetwork` field to `AppSettings` (persisted per-user in the database), thread it through `FeedRefreshService` → `controlledFetchText()`, and add a toggle switch in the Settings UI.

### Files to touch (ordered by dependency)

#### 2a. Server: settings schema — `apps/server/src/settings-service.ts`

Add to `AppSettings`:
```typescript
export type AppSettings = {
  // …existing fields…
  fetch: {                                  // new
    allowPrivateNetwork: boolean;           // new
  };
};
```

Add default value alongside existing defaults:
```typescript
const DEFAULT_FETCH_SETTINGS = { allowPrivateNetwork: false } as const;
```

Merge it in `getSettings()` / `defaultSettings()`.

#### 2b. Server: settings service — `apps/server/src/settings-service.ts`

Update `UpdateSettingsResult` to accept partial `fetch` updates, and apply them in `updateSettings()`.

#### 2c. Server: pass setting to `FeedRefreshService` — `apps/server/src/app.ts`

In `app.ts` where `FeedRefreshService` is constructed (~line 814), pass the new setting:
```typescript
const feedRefreshService = new FeedRefreshService({
  // …
  allowPrivateNetwork: settingsService.getSettings().fetch.allowPrivateNetwork,
});
```

Add `allowPrivateNetwork` to `FeedRefreshServiceOptions` type in `apps/server/src/feed-refresh-service.ts` and pass it through to `controlledFetchText()`:

```typescript
result = await controlledFetchText(feedUrl, {
  // …existing options…
  allowPrivateNetwork: this.options.allowPrivateNetwork,
});
```

#### 2d. Server: DB migration (if needed)

If `settings` are stored as a JSON blob in a single column, no migration — the new field is absent in existing rows, so code must handle `undefined`. Add a fallback in the settings read path:

```typescript
fetch: {
  allowPrivateNetwork: stored.fetch?.allowPrivateNetwork ?? false,
}
```

If settings are columnar, add the migration step.

#### 2e. Client: API types — `apps/web/src/api.ts`

Add `fetch: { allowPrivateNetwork: boolean }` to `AppSettings` and an optional `fetch` block to `UpdateSettingsInput`.

Add to `defaultAppSettings`:
```typescript
fetch: {
  allowPrivateNetwork: false,
}
```

#### 2f. Client: Settings UI — `apps/web/src/settings/SettingsWorkspace.tsx`

In the "Basics" tab (`hidden={activeTab !== "basic"}` section), add a new toggle card. Likely after the telemetry toggle or as a new settings-card section:

```tsx
<section className={classNames(styles.settingsSection, "settings-card")} hidden={activeTab !== "basic"} aria-labelledby="settings-network-title">
  <h2 id="settings-network-title">{t.settings.sections.fetch.title}</h2>
  <label className={styles.settingRow}>
    <span>{t.settings.sections.fetch.allowPrivateNetwork}</span>
    <Switch
      checked={draft.fetch.allowPrivateNetwork}
      onChange={(checked) => updateDraft({ fetch: { allowPrivateNetwork: checked } })}
    />
  </label>
  <p className={styles.settingHint}>{t.settings.sections.fetch.allowPrivateNetworkHint}</p>
</section>
```

The toggle only affects newly-initiated fetches; existing fetch-failure states remain until the next refresh.

#### 2g. Client: i18n strings

Add keys to the locale dictionaries:
- `settings.sections.fetch.title` — "Network" / "网络"
- `settings.sections.fetch.allowPrivateNetwork` — "Allow private-network feeds" / "允许私有网络订阅源"
- `settings.sections.fetch.allowPrivateNetworkHint` — "Enable if you host feeds on localhost or a local network" / "如需订阅 localhost 或内网订阅源，请开启"

---

## Not in scope

- `DIBAO_FETCH_ALLOW_CIDRS` — not exposed in the UI. The toggle only controls the boolean `allowPrivateNetwork`. A future improvement could add CIDR field.
- `DIBAO_FETCH_ALLOW_PRIVATE` env var override — kept as a server-wide override that takes precedence if set.
- Other error paths (`userMessageForError` is also called for plugin errors, embedding errors, etc.). The `details.cause` formatting is generic and improves those paths too.
- `FullContentExtractionService` and `PluginService` — also call `controlledFetchText()` but are not wired to `allowPrivateNetwork` yet.

---

## Implementation order

1. **Task 1** (`userMessageForError` fix) — one-file change, trivially safe, verified by existing test at `apps/web/src/api.test.ts:1536`.
2. **Task 2** — follow the dependency chain: settings types → service → app wiring → client types → UI → i18n.
