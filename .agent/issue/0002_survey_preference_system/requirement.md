# Requirement

## 1. Source Preference Survey

Add a survey UI accessible per source (context menu or source detail page) with these controls:

- **「报道频率」Frequency feedback**: "Too much" / "Too little" / "Just right"
  - "Too much" → lower the source's effective score and reduce its sourceCap below the base value
  - "Too little" → increase its effective score (boost rare quality sources)
  - "Just right" → no adjustment (or slight boost as confirmation)

- The survey output becomes a multiplier on the computed source score, stored as a new field per feed (e.g. `feed_survey_frequency_bias: -1 | 0 | 1`)

## 2. Content Depth Index

Introduce a per-article `contentDepth` estimate based on:
- Article body length (word count / reading time)
- Heuristic: long-form (> 15 min reading time) = high depth, short (< 3 min) = low depth

The depth signal feeds into the MMR score:
- If content depth is **high** → the article is more "valuable" — it satisfies more reading time per slot. The source gets a score bonus per article.
- If content depth is **low** → reduce the article's marginal value (a 2-minute news blip takes up the same list slot as a 10-minute analysis piece, which arguably wastes screen real estate).

The depth modifier should be conservative — start as a small ±5% adjustment, tune from real user data.

## 3. Combined effect

```
final_source_score = computeSourceScore(...) * surveyBias(feedId) * avgDepthBoost(feedId)
```

Where:
- `computeSourceScore` = existing normalizedSourceScore (count or ratio mode)
- `surveyBias(feedId)` = 0.7 (too much) | 1.0 (neutral) | 1.3 (too little)
- `avgDepthBoost(feedId)` = tanh(averageContentDepthInFeed / avgContentDepthAcrossSources)
