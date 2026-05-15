import { calculateBaselineRankScore } from "@dibao/ranking";
import type { ArticleRankExplanationSourceRow, RankingRepository } from "@dibao/db";

export interface ArticleRankingRecalculator {
  recalculateArticle(articleId: string): number;
  recalculateArticles(articleIds: string[]): number;
  recalculateAll(): number;
}

export type RankExplanationReasonType =
  | "source"
  | "freshness"
  | "state"
  | "fallback"
  | "negative"
  | "penalty";

export type RankExplanationReason = {
  type: RankExplanationReasonType;
  label: string;
  impact: "positive" | "negative" | "neutral";
};

export type RankExplanationResult = {
  articleId: string;
  reasons: RankExplanationReason[];
  generatedAt: number;
};

export type BaselineRankingServiceOptions = {
  rankings: RankingRepository;
  now?: () => number;
};

export class BaselineRankingService implements ArticleRankingRecalculator {
  private readonly now: () => number;

  constructor(private readonly options: BaselineRankingServiceOptions) {
    this.now = options.now ?? Date.now;
  }

  recalculateArticle(articleId: string): number {
    return this.recalculateArticles([articleId]);
  }

  recalculateArticles(articleIds: string[]): number {
    const candidates = this.options.rankings.listBaseCandidates({ articleIds });
    return this.writeScores(candidates);
  }

  recalculateAll(): number {
    return this.writeScores(this.options.rankings.listBaseCandidates());
  }

  explainArticle(articleId: string): RankExplanationResult | null {
    const source = this.options.rankings.findBaseExplanationSource(articleId);
    if (!source) {
      return null;
    }

    return {
      articleId,
      reasons: rankReasonsFor(source),
      generatedAt: source.rank?.calculatedAt ?? this.now()
    };
  }

  private writeScores(candidates: ReturnType<RankingRepository["listBaseCandidates"]>): number {
    const now = this.now();

    for (const candidate of candidates) {
      const score = calculateBaselineRankScore({
        now,
        publishedAt: candidate.publishedAt,
        discoveredAt: candidate.discoveredAt,
        sourceWeight: candidate.sourceWeight,
        feedPositiveScore: candidate.feedPositiveScore,
        feedNegativeScore: candidate.feedNegativeScore,
        feedOpenRate: candidate.feedOpenRate,
        feedFavoriteRate: candidate.feedFavoriteRate,
        feedNotInterestedRate: candidate.feedNotInterestedRate,
        read: candidate.state.read,
        favorited: candidate.state.favorited,
        readLater: candidate.state.readLater,
        hidden: candidate.state.hidden,
        notInterested: candidate.state.notInterested,
        readingProgress: candidate.state.readingProgress,
        behaviorEventWeightSum: candidate.behaviorEventWeightSum,
        behaviorEventCount: candidate.behaviorEventCount
      });

      this.options.rankings.upsertBaseScore({
        articleId: candidate.articleId,
        ...score
      });
    }

    return candidates.length;
  }
}

const MIN_REASON_SCORE = 0.001;
const MAX_REASONS = 5;

function rankReasonsFor(source: ArticleRankExplanationSourceRow): RankExplanationReason[] {
  const rank = source.rank;
  if (!rank) {
    return [
      {
        type: "fallback",
        label: "Basic ranking has not been calculated yet",
        impact: "neutral"
      }
    ];
  }

  const candidates: Array<RankExplanationReason & { magnitude: number; priority: number }> = [];

  if (rank.sourceScore > MIN_REASON_SCORE) {
    candidates.push({
      type: "source",
      label: source.feedTitle,
      impact: "positive",
      magnitude: rank.sourceScore,
      priority: 2
    });
  } else if (rank.sourceScore < -MIN_REASON_SCORE) {
    candidates.push({
      type: "source",
      label: source.feedTitle,
      impact: "negative",
      magnitude: Math.abs(rank.sourceScore),
      priority: 2
    });
  }

  if (rank.freshnessScore > MIN_REASON_SCORE) {
    candidates.push({
      type: "freshness",
      label: "Recent article",
      impact: "positive",
      magnitude: rank.freshnessScore,
      priority: 3
    });
  }

  const positiveStateMagnitude =
    Math.max(rank.stateScore, 0) + Math.max(rank.interestScore, 0);
  if (positiveStateMagnitude > MIN_REASON_SCORE) {
    candidates.push({
      type: "state",
      label: positiveStateLabelFor(source, rank.stateScore, rank.interestScore),
      impact: "positive",
      magnitude: positiveStateMagnitude,
      priority: 4
    });
  } else if (rank.stateScore < -MIN_REASON_SCORE) {
    candidates.push({
      type: "state",
      label: "Read state lowers priority",
      impact: "negative",
      magnitude: Math.abs(rank.stateScore),
      priority: 4
    });
  }

  if (rank.interestScore < -MIN_REASON_SCORE) {
    candidates.push({
      type: "negative",
      label: "Recent behavior lowered the score",
      impact: "negative",
      magnitude: Math.abs(rank.interestScore),
      priority: 1
    });
  }

  if (rank.penaltyScore < -MIN_REASON_SCORE) {
    candidates.push({
      type: "penalty",
      label: source.state.notInterested
        ? "Marked not interested"
        : source.state.hidden
          ? "Hidden article"
          : "Negative state penalty",
      impact: "negative",
      magnitude: Math.abs(rank.penaltyScore),
      priority: 0
    });
  }

  const reasons = candidates
    .sort((left, right) => right.magnitude - left.magnitude || left.priority - right.priority)
    .slice(0, MAX_REASONS)
    .map(({ magnitude: _magnitude, priority: _priority, ...reason }) => reason);

  return reasons.length > 0
    ? reasons
    : [
        {
          type: "fallback",
          label: "Basic ranking has no strong signal yet",
          impact: "neutral"
        }
      ];
}

function positiveStateLabelFor(
  source: ArticleRankExplanationSourceRow,
  stateScore: number,
  interestScore: number
): string {
  const labels: string[] = [];

  if (source.state.favorited) {
    labels.push("Favorited");
  }
  if (source.state.readLater) {
    labels.push("Saved for later");
  }
  if (source.state.readingProgress > 0) {
    labels.push("Reading progress");
  }
  if (labels.length === 0 && stateScore > MIN_REASON_SCORE) {
    labels.push("Article state");
  }
  if (interestScore > MIN_REASON_SCORE) {
    labels.push("Recent behavior");
  }

  return labels.length > 0 ? labels.join(", ") : "Article state increased the score";
}
