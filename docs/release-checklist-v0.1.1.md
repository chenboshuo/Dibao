# Dibao v0.1.1 Release Checklist

Last updated: 2026-05-30

Target tag: `v0.1.1`

Candidate branch: `release/v0.1.1`

## Release Decision

`release/v0.1.1` is cut from the validated `dev` commit `50d2dbb`. Do not merge to `main` or create the `v0.1.1` tag until all release gates below pass and the user explicitly approves the tag operation.

## Blocking Pre-Tag Items

| Status | Item | Acceptance |
| --- | --- | --- |
| Done | Version bump | Root and workspace package versions, shared `dibaoVersion`, version tests, and Web UI version output are aligned to `0.1.1`. |
| Done | License snapshot | `LICENSE.md` freezes Release Date `2026-05-30` and Change Date `2030-05-30`; Docker license labels carry the same Change Date. |
| Done | Migration list | Release notes list the SQL migration newly applied after v0.1.0 and the v0.1.1 blocking derived-data upgrade. |
| Done | User release notes | Simplified Chinese, English, and Japanese notes explain user-visible changes, upgrade impact, backup guidance, rollback, known limitations, and that embeddings are not recomputed. |
| Done | Validation gates | Typecheck, tests, build, sqlite-vec spike, Docker build, Compose config, Docker smoke, install/upgrade checks, Sentry config verification, E2E, performance gate, and whitespace check pass on the release branch. |
| Done | Docker release image | Local `dibao:v0.1.1` image is built with private Sentry config and verified before publishing/moving release aliases. The tag-triggered GitHub workflow must publish the final GHCR image from this commit. |
| Pending | Explicit tag approval | User approves merge to `main`, tag creation, and moving release aliases. |

## Pre-Tag Validation

Run from the release branch:

```bash
git switch release/v0.1.1
git status -sb
npm run typecheck --workspaces --if-present
npm test --workspaces --if-present
npm run build --workspaces --if-present
npm run spike:sqlite-vec
docker buildx build --platform linux/amd64 --load --secret id=dibao_sentry_config,src=config/sentry.json -t dibao:v0.1.1 .
docker compose config
npm run smoke:docker-recommendation
npm run perf:recommendation
npm run e2e
git diff --check
```

Expected result:

- Git worktree contains only intentional release artifacts before the release commit.
- NPM validation commands pass.
- Docker image builds for `linux/amd64`.
- Docker release image contains non-empty runtime Sentry config and non-empty browser Sentry config, reported only as booleans.
- Fresh install with an empty Docker volume starts successfully and reports `setupCompleted:false`.
- Upgrade from a v0.1.0 Docker volume applies pending migration `018_interest_cluster_calibrations.sql` and reports healthy status.
- The Synology data-path regression has already been validated on `dev` with the v0.1.1 blocking derived-data upgrade, without recomputing embeddings.
- Compose config is valid.
- Docker recommendation smoke completes provider setup, backfill, diagnostics, and recommended list checks.
- Performance report is regenerated or confirmed in `docs/recommendation-performance.md`.
- No whitespace errors remain.

## v0.1.1 Functional Acceptance

| Area | Status | Acceptance |
| --- | --- | --- |
| Blocking upgrade UX | Done | Ordinary APIs are blocked while required derived recommendation data is rebuilt; progress and current step remain visible. |
| Embedding cost boundary | Done | Upgrade copy states that no embedding rebuild is performed and no embedding API cost is created by this migration. |
| Per-index calibration | Done | Active calibration is generated per embedding index from provider/model/dimension and local vector distribution, with conservative fallback for low-sample data. |
| Interest clusters | Done | Rebuild avoids both giant-cluster collapse and all-singleton fragmentation on the Synology data copy. |
| Topic families | Done | Families have configurable positive/negative caps and maturity gates, and singleton leftovers are not forced into mature families. |
| Ranking | Done | Topic families explain and diversify; broad families do not directly amplify semantic recommendation score. |
| Labels responsiveness | Done | Label rebuild work is batched/yielding so upgrade and labels UI remain responsive on low-power hardware. |
| Docker release telemetry | Done | Local release image includes effective Sentry runtime/browser config from private build secret; final GHCR image must be rechecked after tag-triggered publish. |

## Known v0.1.1 Boundaries

- v0.1.1 does not recompute embeddings during upgrade. Users who intentionally switch embedding model or dimension still need to generate embeddings for the new index.
- Calibration quality is conservative for libraries with few usable behavior samples.
- The first derived-data upgrade can take time on small NAS devices, but it is blocking by design so stale profile data cannot affect recommendations.

## Tagging Commands

Do not run these until all blocking pre-tag items are done and the user explicitly approves tagging.

```bash
git switch main
git pull --ff-only
git merge --no-ff release/v0.1.1
git tag -a v0.1.1 -m "Dibao v0.1.1"
git push origin main
git push origin v0.1.1
```

## Recommended GitHub Release Settings

- Release title: `Dibao v0.1.1`
- Mark as latest release: yes.
- Mark as prerelease: no, unless the user chooses to keep early releases prerelease.
- Attachments: none required for source release.
- Body: use `docs/release-notes-v0.1.1.md`.
