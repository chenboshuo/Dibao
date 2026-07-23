# Problem: Source diversity settings UI + ratio mode + test fixes

The hard cap and adjacency changes (0003) work, but:

1. **No settings UI** — users can't see or override the current sourceCap (computed from cocoonLevel, range 3-12). Source scoring mode is hardcoded to count-based.
2. **No ratio mode** — a feed with 100 articles and 5 opens (5%) ranks the same as or higher than a feed with 4 articles and 4 opens (100%), which is misleading for users who want engagement density.
3. **3 broken tests** — the hard cap broke `feedId` FOREIGN KEY constraints and shifted expected ordering in `profile-ranking.test.ts`.
