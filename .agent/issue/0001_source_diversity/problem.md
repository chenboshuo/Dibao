# Problem: Source diversity too weak in MMR rerank

The MMR rerank in `rerankCanonicalWindow` used a linear soft penalty (`sourceCount * 0.01`) for source diversity. Each additional article from the same feed cost only -0.01, too weak to compete against strong interest signals. A high-volume news feed could occupy 6-8 slots.

Additionally, articles from the same feed could appear adjacent, creating a poor reading experience.

## Follow-up issues

- [0003](../0003_penalty_to_hard_skip/) — the penalty→hard-skip refactor (extracted for focused tracking)
- [0004](../0004_settings_and_tests/) — settings UI, ratio mode, broken test fixes
