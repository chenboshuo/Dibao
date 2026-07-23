# Plan

This is a large proposal affecting multiple subsystems:

| Layer | Change |
|-------|--------|
| DB | New `feed_survey` table or columns; `contentDepth` on articles |
| Server | Survey service + API; contentDepth computation (word count heuristic) |
| Ranking | Survey + depth multipliers in `normalizedSourceScore` |
| Frontend | Survey UI (per-source); depth indicator on article cards |
| i18n | New survey strings in 3 locales |

## References

- Parent issue: [0001](../0001_source_diversity/) — hard cap, adjacency, count/ratio scoring mode
- The survey approach replaces the assumption that "like button" alone captures user preference
- Content depth complements sourceCap: cap limits *how many*, depth adjusts *which ones*
