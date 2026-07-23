# Problem: Dynamic scoring cannot use Python ML ecosystem without process isolation

## Summary

All scoring logic runs in Node.js in-process. If we want to add real ML models (PyTorch, sklearn, sentence-transformers) or isolate scoring from the main server process, there is no extraction path — the dynamic scoring code is tightly coupled to the TypeScript monorepo.

## Evidence

**Current dynamic scoring is pure math but growing in complexity** (`apps/server/src/ranking-service.ts:1539-1681`):

- `interestMatchesFor()` — cosine similarity between article embedding and cluster centroids
- `recentIntentMatchesFor()` — same comparison against recent intent profiles
- `ftrlPredict()` — feed-forward inference over a `Map<string, number>` model
- `calculateV2Score()` — orchestrates all the above into a blended score

**The FTRL model** (`ranking-service.ts:1102-1142`) is a simple weighted sum:
```typescript
const weights = new Map<string, number>();
// 20+ hand-crafted features: 'semantic', 'freshness', 'source', 'state', etc.
let logit = 0;
for (const [name, value] of features) {
  logit += (weights.get(name) ?? 0) * value;
}
return clamp(1 / (1 + Math.exp(-logit)), 0, 1);
```

This is a placeholder for what should be a real ML model. Currently:
- No feature engineering pipeline
- No model versioning or A/B testing framework
- Only FTRL (no neural networks, no tree-based models)
- Training examples are logged but the training loop is simple

**Cross-language boundary is not designed.** Everything runs in one Node process:
- `packages/db/` — SQLite access (can't easily share with Python)
- `packages/ranking/` — pure math (would need porting or wrapping)
- `apps/server/src/ranking-service.ts` — orchestration (tightly coupled to Fastify request lifecycle)

## Impact

- Cannot use Python's ML ecosystem (scikit-learn, PyTorch, huggingface transformers)
- Model improvements are limited to hand-crafted weighted sums
- No fault isolation — a crash in scoring logic crashes feed ingestion too
- Cannot scale scoring independently from the main API server

## Expected

A clean service boundary for dynamic scoring. The dynamic scoring module communicates via HTTP or message queue. It can be:
- Written in Python (Flask/uvicorn)
- Scaled independently
- Replaced without touching the feed ingestion or static scoring
- Extended with real ML models

The extraction path is prepared by the modularization work (claude#0003) so that `DynamicScoreService` can be wrapped in an HTTP client at the TS side and served by a Python process.

## Context

- `apps/server/src/ranking-service.ts:1539-1681` — `calculateV2Score()` — the function that would become the Python service API
- `packages/ranking/src/index.ts` — vector math (would need numpy port)
- `packages/db/src/vector/` — sqlite-vec vector store (Python would need a different vector DB or shared SQLite)
