# Verify & Emergency Fix: Stuck running job blocks queue

**Date:** 2026-06-29 14:32
**Context:** After the `DIBAO_BACKGROUND_JOBS` fix was applied (the first diagnosis), feeds **still** stopped updating hours later. Root cause this time: a `feed_refresh` job got stuck in `running` status for 8+ hours, blocking the single-threaded job runner.

---

## 1. Verify — Detect a stuck running job via curl

Dibao has a `GET /api/jobs` endpoint (no web UI for job management), limited to 100 results max:

### Check 1: Find any stuck running feed_refresh jobs

```bash
curl -s 'http://localhost:8038/api/jobs?type=feed_refresh&status=running&limit=5' | \
  jq '.data[] | {id, status, started_at, attempts, error}'
```

**Expected if stuck:** one job with `started_at` many hours ago (e.g. `06:05:11`) and still `running`.

### Check 2: Count queued feed_refresh jobs (blocked behind stuck one)

```bash
curl -s 'http://localhost:8038/api/jobs?type=feed_refresh&status=queued&limit=1' | \
  jq '.data | length'
```

**Note:** API maxes at 100, so this only shows "1 or more queued", not the true count.

For exact count, use SQLite:

```bash
sqlite3 data/dibao.sqlite "SELECT type, status, COUNT(*) FROM jobs WHERE type='feed_refresh' GROUP BY status;"
```

### Check 3: Last successful feed_refresh timestamp

```bash
curl -s 'http://localhost:8038/api/jobs?type=feed_refresh&status=succeeded&limit=3' | \
  jq '.data[] | {id, finished_at}'
```

**Expected if stuck:** `finished_at` from many hours ago (e.g. `01:33:40` — 11+ hours stale).

### Full API diagnostic (single command)

```bash
for status in running queued succeeded failed; do
  echo "=== $status ==="
  curl -s "http://localhost:8038/api/jobs?type=feed_refresh&status=$status&limit=3" | \
    jq -c '.data[] | {id, status, started_at, finished_at, attempts, error}'
  echo
done
```

### Why a single running job blocks the queue

- `JobRunner.runDueOnce()` claims jobs one at a time via `claimNextDue()` which uses `LIMIT 1` — serial execution.
- `drainDue()` loops calling `runDueOnce()` in a `while` loop, but `await handler(job)` never returns if the RSS fetch hangs.
- **No timeout/abort mechanism** in `JobRunner` — neither in the runner itself nor in `FeedRefreshCoordinator.refreshFeed()`.
- `recoverStaleRunningJobs()` is only called once at `jobRunner.start()`, so a job that gets stuck mid-run stays stuck until restart.

---

## 2. Emergency Fix — Choose the right option

### Option A: Cancel the one stuck running job (quickest)

If only a single job is stuck in `running` status, cancel it so the runner can move on:

```bash
# 1. Find the stuck job ID first
sqlite3 data/dibao.sqlite "
  SELECT id, type, started_at, attempts
  FROM jobs
  WHERE status='running'
  ORDER BY started_at;
"

# 2. Cancel it (replace the ID with the actual one)
sqlite3 data/dibao.sqlite "
  UPDATE jobs
  SET status='cancelled',
      error='Cancelled manually - stuck for 8h during RSS fetch',
      finished_at=(strftime('%s','now')*1000),
      updated_at=(strftime('%s','now')*1000)
  WHERE id='job_xxx'
    AND status='running';
"
```

After the update, the job runner picks up the next queued job within `pollIntervalMs` (30s).

### Option B: Reset ALL stuck running jobs to queued

Useful when many jobs are stuck (e.g. after Ollama outage, embedding_generate jobs stuck everywhere):

```bash
sqlite3 data/dibao.sqlite "
  UPDATE jobs
  SET status='queued',
      started_at=NULL,
      error='Reset from stale running',
      updated_at=(strftime('%s','now')*1000)
  WHERE status='running'
    AND started_at < (strftime('%s','now')*1000 - 3600000);
  -- resets any running job older than 1 hour
"
```

**Warning:** This is safe only if you are CERTAIN no job is genuinely still executing. If a process is mid-work, resetting it lets another runner pick it up, causing duplicate work.

### Option C: Clear all pending queued jobs of a type

When you want to wipe the slate and let the scheduler re-enqueue fresh jobs (e.g. after a days-old backlog):

```bash
# Cancel all queued feed_refresh jobs (can't run anyway if source is dead)
sqlite3 data/dibao.sqlite "
  UPDATE jobs
  SET status='cancelled',
      error='Cleared manually - backlog too stale',
      finished_at=(strftime('%s','now')*1000),
      updated_at=(strftime('%s','now')*1000)
  WHERE type='feed_refresh'
    AND status IN ('queued', 'deferred');
"

# After clearing, force re-enqueue due feeds immediately:
curl -s -X POST 'http://localhost:8038/api/feeds/enqueue-due' | jq .
```

**Note:** `POST /api/feeds/enqueue-due` exists (see `app.ts:2538`) — it calls `feedRefreshJobService.enqueueDueFeeds()`. Use this after a bulk cancel to kick-start fresh jobs.

### Option D: Cancel ALL stale running + queued embedding_generate (Ollama-related)

When embedding_generate is failing en masse and you don't want those jobs clogging the view:

```bash
sqlite3 data/dibao.sqlite "
  UPDATE jobs
  SET status='cancelled',
      error='Cleared manually - Ollama unreachable, will retry later',
      finished_at=(strftime('%s','now')*1000),
      updated_at=(strftime('%s','now')*1000)
  WHERE type='embedding_generate'
    AND status IN ('running', 'queued');
"
```

### Option E: Restart the server (triggers recoverStaleRunningJobs)

If you can tolerate a brief downtime, restarting is the safest — it calls `recoverStaleRunningJobs()` once at startup, resetting all `running` jobs to `queued` (or `failed` if attempts exhausted):

```bash
# Find the running server process
ps aux | grep dibao | grep -v grep

# Kill and restart with correct env
kill <PID>
DIBAO_BACKGROUND_JOBS=true DIBAO_HOST=0.0.0.0 DIBAO_PORT=8038 \
  DIBAO_DATABASE_PATH=../database/dibao.sqlite DIBAO_COOKIE_SECURE=false \
  node apps/server/dist/index.js
```

---

## Decision matrix

| Scenario | Best option |
|---|---|
| Single stuck job, queue is healthy | **A** — cancel just that job |
| Mass stuck jobs after crash/outage | **B** — reset all stale running |
| Backlog of thousands after days offline | **C** + API re-enqueue |
| Ollama still down, stop wasting retries | **D** — clear embedding_generate |
| Server restart already needed | **E** — let startup recovery handle it |

---

## API gap

There is **no** `POST /api/jobs/:id/cancel` — the only cancel route is `/api/plugins/:id/tasks/:runId/cancel` (plugin-specific). No web UI for job management exists. This means every stuck job scenario requires either a server restart (triggers `recoverStaleRunningJobs`) or direct SQLite access.

## Recommended code fixes

1. **HTTP timeout on RSS fetch** — add `AbortSignal.timeout(60_000)` to feed refresh handler
2. **Add cancel API** — `POST /api/jobs/:id/cancel` REST endpoint
3. **Periodic stale-job recovery** — not just at startup; check for dangling `running` jobs every N minutes
