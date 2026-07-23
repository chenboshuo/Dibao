# Discussion: Extension System vs. Background Jobs Infrastructure

## Context

Issue #0010 revealed a structural problem: `DIBAO_BACKGROUND_JOBS=false` (or unset) stops **everything** — including plugin tasks. This prompted the question: _can the extension system (plugin system) itself fix this, or is the background jobs infrastructure a deeper architectural issue that extensions can't reach?_

## Current Architecture

```
buildServer() ──→ backgroundJobs? ──→ startBackgroundServices()
                                            │
                        ┌───────────────────┴───────────────────┐
                        │                                       │
                   JobRunner(drainDue)                   PluginService
                        │                                       │
            ┌───────────┼───────────────┐                       │
            │           │               │                  enqueueDueSchedules()
        feed_refresh  embedding    plugin:*               emitHook("maintenance.tick")
                        │               │
                    core job        PluginService
                    handlers       .handlePluginJob
```

Key properties:

- `JobRunner` is instantiated **inside** `buildServer()` closure (`app.ts:1030-1085`). All core job handlers (`feed_refresh`, `embedding_generate`, etc.) are hardcoded as `Partial<Record<JobType, JobHandler>>`.
- Plugin jobs (`plugin:*` type prefix) are routed through `pluginHandler` — one catch-all entry point, handled by `PluginService.handlePluginJob`.
- `startBackgroundServices()` (`app.ts:1330-1397`) starts `JobRunner`, all schedulers, and the maintenance tick timer. It is gated by the `backgroundJobs` boolean.
- Plugin tasks are **consumers** of the JobRunner — they enqueue jobs with `plugin:pluginId:taskId` type, and the JobRunner picks them up. They do not **extend** the JobRunner itself.

## What the Extension System CAN Already Do

| Capability | Works with backgroundJobs=false? |
|---|---|
| UI contributions (tabs, actions, routes) | ✅ Yes |
| Hook handlers (on article.created, etc.) | ✅ Yes (synchronous, no jobs) |
| Plugin API routes (GET/POST) | ✅ Yes |
| Plugin storage/KV/database tables | ✅ Yes |
| **Background tasks** (scheduled or manual) | ❌ No — JobRunner not running |
| **Deliveries** (webhook-style retries) | ❌ No — JobRunner not running |
| **Events.emit** (cross-plugin hooks) | ❌ No — enqueues via JobRunner |

The extension system cannot fix the `backgroundJobs` gate because:
1. The gate is evaluated **before** any plugin is loaded or activated.
2. Plugin activation happens during `startBackgroundServices()` (via `maintenance.tick` → `enqueueDueSchedules()`).
3. There is no "late-join" mechanism: once `startBackgroundServices()` returns without starting the JobRunner, plugins have no way to start it later.

## What an Extension COULD Fix (But Doesn't Today)

### 1. Per-plugin `forceBackgroundJobs` flag

A plugin manifest could declare `"requiresBackgroundJobs": true`. During `reconcileOfficialPlugins()` (which runs on every startup, even without background jobs), the system could detect this and force-enable the background services layer.

**Problem**: `reconcileOfficialPlugins()` currently only handles metadata reconciliation — it does not and cannot start the JobRunner. The `backgroundJobs` flag is consumed at `buildServer()` level before `pluginService` is even fully wired.

### 2. Plugin declaring its own scheduler

A plugin could declare `"contributes": { "schedulers": [...] }` to register a tick-based callback without using the JobRunner. This would bypass the dependency on `drainDue()` entirely.

**Problem**: The tick loop is currently inside `startBackgroundServicesNow()` (`app.ts:1374-1396`) and is also gated by `backgroundJobs`. Plugins have no access to `setInterval`-like primitives through the Host API — they can only schedule tasks via the JobRunner.

## Underlying issues

### A. The `backgroundJobs` gate is an all-or-nothing switch

```
app.ts:500    const backgroundJobs = options.backgroundJobs ?? false;
app.ts:1331   function startBackgroundServices(): void {
app.ts:1332     if (!backgroundJobs) {
app.ts:1333       return;
app.ts:1334     }
```

There is no middle ground (e.g., "core jobs off, plugin jobs on"). This is a binary flag from early in the project when the only background tasks were feed refreshes.

### B. JobRunner is a shared, non-extensible resource

Core jobs and plugin jobs share the same `JobRunner` instance, the same poll interval, the same `maxJobsPerDrain` cap, and the same `beforeRun` decision gate. A long-running core job can block plugin task execution (JobRunner is single-threaded per `drainDue()`).

### C. Plugin tasks cannot be long-lived

The `PLUGIN_TASK_PAUSED_RETRY_MS` is hardcoded to 6 hours in `plugin-service.ts:78`. If a plugin task fails because the system is in foreground quiet window or the plugin runtime crashed, the job is deferred for 6 hours regardless of when background jobs resume.

### D. No startup warning when plugins are stranded

In issue #0010, the feeds were stale but the UI was healthy. If a plugin had declared background tasks, there would be no indicator in the plugin management UI that its tasks are queued but cannot run because `backgroundJobs=false`.

## Design Options

### Option 1: Introduce `backgroundJobsMode: "all" | "core" | "plugins" | "none"`

Replace the boolean with an enum. This would:

- Let `buildServer()` accept `backgroundJobsMode: "all" | "core" | "plugins" | "none"` instead of `backgroundJobs: boolean`.
- The `DIBAO_BACKGROUND_JOBS=true` env var maps to `"all"` (default if absent → `"none"`).
- Future env var: `DIBAO_BACKGROUND_JOBS_MODE=plugins` starts the JobRunner **only** for `plugin:*` jobs, skipping core schedulers.
- This is the **minimum change** to fix the extension-story gap without restructuring.

**Trade-off**: Still all-or-nothing within the JobRunner — plugin jobs still share the single thread.

### Option 2: Decouple plugin jobs into a second JobRunner

Create a separate `PluginJobRunner` instance or a dedicated plugin job queue with its own `backgroundPluginJobs` flag:

```
buildServer({
  backgroundJobs: true,         // core jobs
  backgroundPluginJobs: true,   // plugin jobs (defaults to backgroundJobs if unset)
})
```

This separates concerns:
- A "plugin-only" server process could set `backgroundJobs=false, backgroundPluginJobs=true`.
- Plugin job thundering herd does not starve core feed refreshes.
- Each runner can have its own `maxJobsPerDrain`, `pollIntervalMs`, and `beforeRun` gate.

**Trade-off**: Two poll loops hitting the same `jobs` table; need to coordinate `recoverStaleRunningJobs()` across both runners to avoid double-claiming plugin jobs.

### Option 3: Plugin-level tick/scheduler host API

Add a Host API method (`scheduler.registerTick(taskId, intervalMs, callback)`) that runs in the plugin host process itself, independent of the server's JobRunner. The plugin host process can use its own `setInterval` to drive periodic work without enqueuing DB jobs.

**Trade-off**: No persistence across restarts; no retry, backoff, or job history. Suitable for lightweight polling (e.g., "check API every 5 minutes") but not for deliveries or work that must survive crashes.

### Option 4: Always-run-minimal JobRunner

Always start the JobRunner, but let it process **only** plugin jobs when `backgroundJobs=false`:

```typescript
// JobRunner always starts, but may have empty handlers map
const jobRunner = new JobRunner({
  handlers: backgroundJobs ? ALL_HANDLERS : { /* no core handlers */ },
  pluginHandler: pluginService.handlePluginJob,  // always present
});
```

This is closest to "extension system fixes it" — once a plugin is installed and enabled, its tasks run regardless of the env var. Core jobs (feed_refresh, embedding) are simply not registered.

**Risk**: User may not expect any background activity when they set `DIBAO_BACKGROUND_JOBS=false`. Leads to surprising network traffic from plugin tasks.

## Recommendation

**Adopt Option 4 (always-run-minimal JobRunner) + Option 3 (plugin-level tick API)** as complementary changes:

1. **Options 4** — Always start the JobRunner, but only register core handlers when `backgroundJobs=true`. Always register `pluginHandler`. This makes plugin tasks independent of the `DIBAO_BACKGROUND_JOBS` flag.

2. **Signal the startup state** — The server should emit a startup warning when `backgroundJobs=false` but plugin tasks are enabled:

   ```
   [warn] background jobs disabled: plugin "daily-brief" task "generate"
          will use JobRunner but core handlers (feed_refresh, embedding) are not registered
   ```

3. **Option 3** — Add a lightweight `scheduler.tick(intervalMs, handler)` Host API for plugins that do not need persistence/retry, so they can run periodic work entirely within their host process without touching the JobRunner.

A hybrid approach fixes the issue reported in #0010 (plugin tasks should not be collateral damage of `DIBAO_BACKGROUND_JOBS=false`) while keeping the extension story honest: plugins extend the app, but the app's own background infrastructure gate should not silently kill plugin behavior.

---

## Follow-up: The `backgroundJobs` gate controls too much (2026-07-02)

### Question

User asked: "Background jobs (feed refresh) seems like a basic function for a self-hosted RSS reader. Why does it need an explicit env var to enable it?"

### Analysis

Initially the answer seemed like a developer oversight (opt-in vs opt-out). But digging deeper, the real issue is **scope**: `backgroundJobs` controls **everything** — not just feed refresh:

| Category | Jobs | Resource impact |
|---|---|---|
| **Basic RSS** | `feed_refresh` | Low (HTTP fetch) |
| **Feed lifecycle** | `feed_refresh` scheduling, `retention_cleanup` | Low |
| **ML pipeline** | `embedding_generate` | **High** (calls Ollama/Gemini API for every article) |
| | `vector_index_rebuild` | Medium |
| **Recommendation** | `ftrl_train` | **High** (CPU-bound model training) |
| | `interest_cluster_*`, `keyword_profile_rebuild` | Medium-high |
| | `recommendation_backfill` | Medium |
| **Plugin** | `plugin:*` | Varies |

The author's original intent was likely: on low-end hardware (or during development), a single `DIBAO_BACKGROUND_JOBS=false` turns off everything expensive. But this has a bad side effect: **feed refresh (the most basic function) is collateral damage.**

### Decision

For now: changed to **opt-out** (`!== "false"`). Feeds will refresh by default. Set `DIBAO_BACKGROUND_JOBS=false` to kill everything.

But the better long-term fix would be **separate controls** — e.g. `feed_refresh` always runs, while ML/recommendation jobs have their own toggle. This could live in the Settings UI ("Basics" tab) as a simple checkbox or section.

### TODO: Settings UI

Add a "Background jobs" control in the Settings → Basics page so users can toggle ML/recommendation pipelines on/off without stopping feed refreshes. This is more discoverable than an env var and doesn't require a server restart.

---

## Priority fix: feed_refresh should preempt embedding_generate (2026-07-02)

### Problem

Even with background jobs enabled, feed refreshes were barely running. The issue was **priority starvation**:

- `feed_refresh` and `embedding_generate` both defaulted to `priority: 0`
- JobRunner picks jobs by `ORDER BY priority DESC, run_after, created_at`
- 10K+ queued `embedding_generate` jobs (each ~30s due to Ollama calls) blocked `feed_refresh` from being picked — they shared the same priority queue
- Result: only a trickle of feed refreshes got through each hour

### Fix

Three changes applied:

**1. Add `FEED_REFRESH_JOB_PRIORITY = 50`** (`apps/server/src/feed-refresh-job-service.ts`)

Feed refreshes now get priority 50, ahead of embedding (0) and most other tasks. Only `behavior_event_project` (60) and `profile_event_process` (40) are nearby — both are lightweight.

Comparison of existing priorities:

| Job type | Priority |
|---|---|
| `behavior_event_project` | 60 |
| **`feed_refresh`** | **50** (was 0) |
| `profile_event_process` | 40 |
| (everything else) | 0 |
| `ranking_recalculate` | -20 |

Rationale: feed freshness is the primary value of an RSS reader. Embedding/recommendation work is computed on already-fetched articles and can wait.

**2. Updated existing queued jobs** via SQL:
```sql
UPDATE jobs SET priority = 50 WHERE type = 'feed_refresh' AND status = 'queued';
```

**3. Cleared 10,019 stale `embedding_generate` queued jobs**

These were from articles already fetched days ago. They'll be re-enqueued as needed by the backfill scheduler after feed refreshes catch up.

### Result

Server restarted at 2026-07-02 13:45. `feed_refresh` jobs are now processed first. Logs confirm feed refreshes completing at a much higher rate.
