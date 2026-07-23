# Problem: Introduce hierarchical retention policy to replace single retentionDays

The SQLite database has grown to **1.5GB** and keeps expanding. The current retention mechanism has several issues:

1. **Single global retentionDays (default 0 = keep forever)**: All articles share one retention threshold. The user must manually set retentionDays to trigger cleanup. The default is 0, so the DB grows unboundedly.

2. **Time-based blanket cutoff**: `listRetentionCandidates` only uses `coalesce(published_at, discovered_at) < cutoff`, with optional exclusion of favorites/read-later. A 15-second news flash and a 30-minute deep analysis have the same lifespan.

3. **Ranking breakdown scores are unused**: The system calculates rich per-article scores (freshnessScore, penaltyScore, interestScore, etc.), but retention logic ignores them entirely.

4. **No fine-grained user control**: The Settings UI has one slider (0-3650) + two checkboxes (keepFavorites/keepReadLater). There's no way to express "keep news flashes short, keep deep dives long."
