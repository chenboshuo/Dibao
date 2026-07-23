---
name: clean-tasks
description: Diagnose & fix a stuck job queue (stale running jobs blocking the single-threaded runner)
---

# clean-tasks

Diagnose and fix Dibao's job queue when feeds stop updating due to stuck jobs.

## Quick diagnostic

```bash
# 1. Find any stuck running jobs (oldest first)
sqlite3 /home/cbs/Documents/RSS/database/dibao.sqlite "
  SELECT id, type, started_at,
    datetime(started_at/1000, 'unixepoch', 'localtime') as started,
    ((strftime('%s','now')*1000 - started_at) / 60000) as min_ago
  FROM jobs WHERE status='running' ORDER BY started_at;
"

# 2. Count jobs by type+status (understand the backlog shape)
sqlite3 /home/cbs/Documents/RSS/database/dibao.sqlite "
  SELECT type, status, COUNT(*) as cnt FROM jobs
  GROUP BY type, status ORDER BY cnt DESC;
"
```

## Emergency fix — pick the scenario

| Scenario | Action |
|---|---|
| Single stuck `feed_refresh`, queue otherwise healthy | **A**: `UPDATE jobs SET status='cancelled', error='Stuck >8h' ... WHERE id='job_xxx'` |
| Mass stuck jobs after crash/outage | **B**: `UPDATE jobs SET status='queued', started_at=NULL ... WHERE status='running' AND started_at < now-1h` |
| Ollama unreachable, `embedding_generate` clogging queue | **D**: `UPDATE jobs SET status='cancelled' WHERE type='embedding_generate' AND status IN ('running','queued')` |
| Runner hung in-memory, server needs restart | **E**: kill + restart with `DIBAO_BACKGROUND_JOBS=true DIBAO_DATABASE_PATH=/home/cbs/Documents/RSS/database/dibao.sqlite` |

## Important notes

- **Database path** is `/home/cbs/Documents/RSS/database/dibao.sqlite` (lowercase `d`). There's another empty DB at `Database/dibao.sqlite` (capital D) — don't touch it.
- The runner is single-threaded: one stuck job blocks everything.
- `recoverStaleRunningJobs()` only runs at startup. Restart is often needed after a SQL fix.
- Server restart command: `DIBAO_BACKGROUND_JOBS=true DIBAO_HOST=0.0.0.0 DIBAO_PORT=8038 DIBAO_DATABASE_PATH=/home/cbs/Documents/RSS/database/dibao.sqlite DIBAO_COOKIE_SECURE=false node apps/server/dist/index.js`
