# Recommendation Performance

Generated at: 2026-05-16T02:10:00.014Z

Dataset:

- Articles: 20000
- Feeds: 100
- Daily distribution: 300-400 new articles/day over recent history
- Behavior events: favorites, read later, read progress, hides, not interested, opens
- Embedding vectors: local deterministic 4-dimensional vectors in `article_embeddings` and sqlite-vec
- Database: `/Users/jeffreywang/dev/邸报/.tmp/perf/recommendation-20k.sqlite`

Results:

| Check | Result |
| --- | ---: |
| Dataset generation | 2829.9 ms |
| Ranking chunk job drain | 4694.6 ms |
| Ranking jobs succeeded | 40 |
| Embedding candidate query | 19.7 ms |
| Recommended API | 42.2 ms |
| Diagnostics/index API | 94.3 ms |

Notes:

- This script is a manual release gate and is not part of `npm test`.
- Ranking runs through `ranking_recalculate` chunk jobs with the default 500 article chunk size.
- The embedding candidate query intentionally leaves a small stale set so missing/stale backfill paths are exercised.
