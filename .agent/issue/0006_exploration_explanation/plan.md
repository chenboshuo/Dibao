# Plan: Fix proposal

## Option A (lightweight): Append explanation to the reason text

In `apps/web/src/App.tsx`, in the reason-type rendering function (~line 9741), show `explorationBucket` and `explorationReason` if present.

Desired effect (in Chinese, keeping existing i18n pattern):

> **探索加分**：本文由破茧算法打捞。你尚未与这篇文章互动，文章在48小时窗口期内，因此获得探索资格。你可在设置页调整算法信息茧房水平。

## Option B (moderate): Add detail row in score breakdown panel

In the score detail drawer, add conditional rows for exploration-eligible articles:
- 探索资格类型: `feed:xxx` / `pending_embedding`
- 探索种子分: `0.xxxxx`

## Option C (heavier): Expandable "exploration diagnosis" section

Add a `<details>` panel below the score list showing the full pipeline:
- Pre-MMR rank → post-MMR rank → post-exploration-slot rank
- Exploration bucket + reason
- Exploration seed score
- Current explorationRatio for the user's cocoonLevel
