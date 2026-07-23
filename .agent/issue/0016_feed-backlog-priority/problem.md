# Problem: Feed refresh backlog processes in oldest-first order — user waits too long for fresh content

## Summary

When the job queue accumulates a large backlog of `feed_refresh` tasks (e.g. after background jobs were disabled), the single-threaded runner processes them in oldest-created-first order. A user opening the app must wait for all 2000+ queued refreshes to drain before their most-interested feeds get fresh content — taking roughly 30+ minutes.

## Evidence

- **2,134** queued `feed_refresh` jobs after ~9 days of interrupted background processing, all with default `priority=0`.
- The runner's claim query ([packages/db/src/repositories/jobs.ts:124](packages/db/src/repositories/jobs.ts#L124)) orders by: `priority desc, run_after, created_at, id`. Since all backlogged jobs share `priority=0`, and each job's `run_after` equals its `created_at` (both set to `now` at enqueue), the effective sort is by **creation time ascending** — the oldest job wins first.
- Oldest queued `feed_refresh` jobs were created **2026-07-12** (10 days old); newest today. All must drain before newly-scheduled jobs can run.
- The backlog accumulated because the server was restarted multiple times with different `backgroundJobs` settings across July 11–22. The scheduler enqueues a new refresh job for every feed on startup, creating duplicates over time — 2,182 feeds × multiple restarts explains the count.
- Observed throughput from this session: ~1 succeeded `feed_refresh` every 2–10 seconds (remote HTTP fetch bound), so 2,134 jobs = **~35–60 minutes** to drain entirely.
- `feeds.last_success_at` timestamps (available in the database) are completely ignored by the job ordering — a feed last refreshed 10 days ago competes equally with one refreshed 2 months ago.

## Impact

- After a server restart or outage, user sees "last updated 10 days ago" for **all** feeds until the entire backlog drains.
- The feeds the user checks most often are not prioritized — they get the same slot as a feed the user never reads.
- A brief outage compounds into a long recovery window, making the app feel broken after every restart with accumulated backlog.

## Expected

When a backlog exists, `feed_refresh` jobs should be ordered by a **three-tier sort**:

1. **Weight (descending)** — feeds with higher `source_weight` (user-marked importance) get refreshed first. User intent drives priority.
2. **Response time (ascending)** — feeds whose servers respond quickly get refreshed first. This "Shortest Job First" approach maximises throughput: quick wins drain fast so the user sees results sooner, and a dead/slow feed never blocks the queue.
3. **Staleness (ascending, i.e. oldest last_success_at first)** — among equally-weighted, equally-responsive feeds, the one that hasn't been updated in the longest time wins.

This way:
- Important feeds the user cares about appear fresh within seconds.
- Fast feeds drain quickly → more new articles per minute, better first impression.
- A broken feed (server down, abandoned blog) never holds up the rest of the queue.
- The perceived recovery time drops from "all 2000 done" to "top 10 done".

## Context

- **Database**: Jobs table (`packages/db/src/repositories/jobs.ts`), `claimNextDue()` at line 113.
- **Job payload**: Each `feed_refresh` job has `{"feedId": "feed_..."}` in `payload_json` — the runner knows which feed to refresh without extra lookups.
- **Feeds table** has `last_success_at` (millisecond timestamp) — the most recent successful fetch. Feeds with `NULL` last_success_at (never successfully fetched) are the stalest of all.
- `claimNextDue()` is the only code path the runner uses for general job claiming (`claimById` is for targeted operations only, e.g. plugin scheduling).
- Related: `agent#0010` — background jobs default to opt-out (fixed the disabling, but not the backlog behavior).
