# Discussion: Risks & caveats

- **The root cause of DB bloat is `retentionDays = 0` being the default.** Setting a sane default (e.g. 90 days) + protecting favorites/read-later would immediately cap growth. The hierarchy refines this; it doesn't replace the need for a better default.
- Retentions runs in batches (100 per job, 1 batch per run). Multi-dimensional filtering increases per-batch CPU cost — may need smaller batches or higher job frequency.
- Scoring data lives in the DB too (`rank_scores` table). Using scores for retention decisions must not create circular dependencies (delete scores → use scores to decide deletion).
- UI complexity increases from one slider to a multi-layer config. Needs a well-designed interaction to avoid overwhelming users.
