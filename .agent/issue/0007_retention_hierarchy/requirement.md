# Requirement: Core idea

retention decision = f(content type, scoring signals, user interaction, time)

## Dimension 1: Content hierarchy (inferred from feed / feed folder)

| Tier | Example content | Suggested retention | Estimated size |
|------|----------------|-------------------|----------------|
| Flash | News alerts, short briefs, summaries | 15 days | ~20GB saved |
| Normal | Blog posts, standard RSS articles | 90 days | — |
| Deep | Long-form analysis, opinion, essays | 365 days | ~20MB |

A new `retentionTier` field on the `feeds` table (enum: `"default" | "flash" | "normal" | "deep"`) determines which tier each article belongs to. Folders can optionally inherit or override. `"default"` falls back to the global `retentionDays` for backward compatibility.

## Dimension 2: Scoring signals

Leverage existing ranking breakdown scores to refine cleanup:

- **`interestScore < threshold`**: Articles with very low user interest can be cleaned early
- **High `penaltyScore` / low `stateScore`**: Articles the user hid or flagged "not interested" — clean with priority
- **High `freshnessScore` but old `publishedAt`**: The article only had recency value — once past retention, it's garbage
- **`explorationBonus > 0` but never opened**: Exploration content the user didn't engage with — clean early

## Dimension 3: User interaction modifiers

Keep the existing favorites/read-later protection. Add:

- **Fully-read articles**: Higher cleanup priority
- **Never-opened articles**: Higher priority than partially-read ones
- **Duplicate/similar articles from the same source**: Keep only the newest or highest-scored one
