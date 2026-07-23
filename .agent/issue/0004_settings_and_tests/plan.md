# Plan: Settings fields, ratio mode, and test fixes

## 1. Settings fields (7 files)

| File | Change |
|------|--------|
| `apps/server/src/settings-service.ts` | Add `sourceCapOverride: number` (0=auto, 3-20 manual), `sourceScoringMode: "count" \| "ratio"` to `AppSettings["ranking"]`, defaults, patch, and `parseRankingPatch` validation |
| `packages/db/src/types.ts` | Add `feedArticleCount: number` to `ArticleRankingCandidateRow` |
| `packages/db/src/repositories/ranking.ts` | JOIN article count per feed in `listCandidates` query |
| `apps/server/src/ranking-service.ts` | `cocoonParameters`: apply override. `normalizedSourceScore`: ratio mode via `tanh((positiveRate - negativeRate) * 8)` with Bayesian safeguard |
| `apps/web/src/api.ts` | Sync both fields |
| `apps/web/src/i18n.tsx` | Labels: zh `频道报送数目` / `来源评分模式`, en `Channel submission count` / `Source scoring mode`, ja `ソース上限` / `ソース評価モード` |
| `apps/web/src/App.tsx` | Settings panel: sourceCap read-only (or override slider) + mode dropdown |

## 2. Test fixes (`apps/server/src/profile-ranking.test.ts`)

- "keeps medium-similarity…" — `feeds.upsert` calls added but needs `createProfileFixture` to return `feeds`
- "treats unlike as weak correction" — partial fix but needs feedStats lookup on per-article feed instead of `feed_profile`
- "REC-031 guards source stats" — ordering shifted; expected index needs updating

## 3. New tests

- Count mode: Feed A (100 articles, 5 opens) > Feed B (4 articles, 4 opens)
- Ratio mode: Feed A (100 articles, 5 opens) < Feed B (4 articles, 4 opens)
