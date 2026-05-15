import { calculateBaselineRankScore } from "@dibao/ranking";
import type { RankingRepository } from "@dibao/db";

export interface ArticleRankingRecalculator {
  recalculateArticle(articleId: string): number;
  recalculateArticles(articleIds: string[]): number;
  recalculateAll(): number;
}

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
