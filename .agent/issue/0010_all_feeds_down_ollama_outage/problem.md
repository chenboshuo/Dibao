# Problem: All feeds not updating — DIBAO_BACKGROUND_JOBS not set

## Summary

After rebuilding the database and restarting the server, all 2143 feeds stopped updating because the process was started **without `DIBAO_BACKGROUND_JOBS=true`**. The code in `apps/server/src/index.ts:7` checks:

```typescript
backgroundJobs: process.env.DIBAO_BACKGROUND_JOBS === "true",
```

Without this env var, `backgroundJobs` defaults to `false` and the JobRunner never starts. 2162 queued feed_refresh jobs sit in the database untouched.

This is **not** a code regression, not an OOM, not a Docker issue, not a database path issue — just a missing environment variable on restart.

## How to reproduce

### Step 1: Check article freshness

```bash
curl 'http://localhost:8038/api/articles?view=latest&limit=100&unreadOnly=false' \
  -H 'accept: application/json'
```

Latest articles will be from before the restart — nothing new since.

### Step 2: Check feed lastSuccessAt

```bash
sqlite3 database/dibao.sqlite "
SELECT strftime('%Y-%m-%d', last_success_at/1000, 'unixepoch') AS day, COUNT(*) AS cnt
FROM feeds WHERE last_success_at IS NOT NULL AND last_success_at > 0
GROUP BY day ORDER BY day DESC;
"
```

No `lastSuccessAt` entries from after the last time background jobs ran.

### Step 3: Check queued feed_refresh jobs (the smoking gun)

```bash
sqlite3 database/dibao.sqlite "
SELECT type, status, COUNT(*) FROM jobs WHERE type = 'feed_refresh' GROUP BY status;
"
```

**Expected:** no queued feed_refresh jobs (or very few).
**Observed:** `queued | 2162` — all waiting, none being processed.

### Step 4: Verify backgroundJobs state

```bash
ps aux | grep DIBAO_BACKGROUND
```

If `DIBAO_BACKGROUND_JOBS` is absent from the process environ, this is the root cause.

## Evidence

### Running process environ

```
DIBAO_HOST=0.0.0.0
DIBAO_PORT=8038
DIBAO_DATABASE_PATH=../database/dibao.sqlite
DIBAO_COOKIE_SECURE=false
```
→ No DIBAO_BACKGROUND_JOBS set → JobRunner disabled.

### Jobs table state

```
feed_refresh | failed   | 122
feed_refresh | queued   | 2162   ← stuck
feed_refresh | succeeded | 3023
```

2162 jobs queued, none running, none completing. Last success: 2026-06-21.

### Feeds table

```
last_success_at distribution:
2026-06-21:  22
2026-06-20:  76
2026-06-19: 732
2026-06-18: 767
2026-06-17: 426
...
```
Nothing after June 21.

### Code

`apps/server/src/index.ts:7`:
```typescript
backgroundJobs: process.env.DIBAO_BACKGROUND_JOBS === "true",
```

When `DIBAO_BACKGROUND_JOBS` is not set or set to anything other than the string `"true"`, this evaluates to `false`.

`apps/server/src/app.ts:500`:
```typescript
const backgroundJobs = options.backgroundJobs ?? false;
```

Unused jobs accumulate in the queue indefinitely.

## Root cause chain

1. User rebuilt database and restarted server
2. Server started **without `DIBAO_BACKGROUND_JOBS=true`** in environment
3. `index.ts` passed `backgroundJobs: false` to `buildServer()`
4. `app.ts:1330` `startBackgroundServices()` returned immediately
5. JobRunner never started → no `drainDue()` loop → no feed refreshes
6. No error logged — the server runs happily, serves old articles, just never processes jobs

## Why diagnostics were misleading

- The server responds to HTTP requests normally
- Old articles are served without any indication of staleness
- No error anywhere in logs or UI about background services being disabled
- The jobs table exists and shows queued jobs, but no UI exposes it
- Multiple false leads during debugging: OOM theory, database path confusion, Ollama theory

## Fix

Restart with `DIBAO_BACKGROUND_JOBS=true`:

```bash
DIBAO_BACKGROUND_JOBS=true DIBAO_HOST=0.0.0.0 DIBAO_PORT=8038 \
  DIBAO_DATABASE_PATH=../database/dibao.sqlite DIBAO_COOKIE_SECURE=false \
  node apps/server/dist/index.js
```

## Recommended improvements

- Consider changing the default in `index.ts` to `process.env.DIBAO_BACKGROUND_JOBS !== "false"` (opt-out instead of opt-in)
- Add a system status indicator in the web UI showing whether background services are running
- Log a warning at startup when background jobs are disabled
