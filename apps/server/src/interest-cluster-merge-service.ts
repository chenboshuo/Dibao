import { createHash } from "node:crypto";
import {
  fromVectorBlob,
  toVectorBlob,
  type DibaoDatabase,
  type InterestClusterMergeCandidateRow,
  type InterestClusterMergeCandidateStatus,
  type InterestClusterMergeRecommendation,
  type InterestClusterPolarity,
  type InterestClusterRow
} from "@dibao/db";
import { clamp, normalizeVector, profileAlgorithmDefaults, cosineSimilarity } from "@dibao/ranking";
import type { InterestClusterLabelService } from "./interest-cluster-label-service.js";

export const INTEREST_CLUSTER_MERGE_DIAGNOSTICS_JOB_TYPE =
  "interest_cluster_merge_diagnostics" as const;
export const INTEREST_CLUSTER_AUTO_MERGE_JOB_TYPE =
  "interest_cluster_auto_merge" as const;

const POSITIVE_DIAGNOSTIC_LIMIT = 64;
const NEGATIVE_DIAGNOSTIC_LIMIT = 32;
const AUTO_MERGE_LIMIT = 5;

type ClusterMergeDbRow = {
  id: string;
  embeddingIndexId: string;
  polarity: InterestClusterPolarity;
  label: string | null;
  centroidVectorBlob: Buffer;
  weight: number;
  sampleCount: number;
  lastMatchedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

type ClusterLabelRow = {
  clusterId: string;
  autoLabel: string | null;
  manualLabel: string | null;
  labelTermsJson: string | null;
  representativeArticlesJson: string | null;
  feedTitlesJson: string | null;
};

type ClusterEvidenceSummary = {
  articleIds: Set<string>;
  feedKeys: Set<string>;
};

type CandidateMetrics = {
  centroidSimilarity: number;
  labelJaccard: number;
  evidenceOverlap: number;
  representativeOverlap: number;
  sourceOverlap: number;
  mergeScore: number;
  recommendation: InterestClusterMergeRecommendation;
};

export type InterestClusterMergeCandidateView = InterestClusterMergeCandidateRow & {
  leftLabel: string;
  rightLabel: string;
};

export type InterestClusterMergeCandidateList = {
  activeIndexId: string | null;
  candidates: InterestClusterMergeCandidateView[];
};

export type InterestClusterMergeDiagnosticsResult = {
  embeddingIndexId: string | null;
  candidateCount: number;
};

export type InterestClusterMergeResult = {
  ok: true;
  candidateId: string;
  survivorClusterId: string;
  mergedAwayClusterId: string;
};

export class InterestClusterMergeServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "InterestClusterMergeServiceError";
  }
}

export type InterestClusterMergeServiceOptions = {
  db: DibaoDatabase;
  clusterLabels: Pick<InterestClusterLabelService, "displayLabelForCluster">;
  now?: () => number;
};

export class InterestClusterMergeService {
  private readonly now: () => number;

  constructor(private readonly options: InterestClusterMergeServiceOptions) {
    this.now = options.now ?? Date.now;
  }

  rebuildActiveIndexCandidates(): InterestClusterMergeDiagnosticsResult {
    const activeIndexId = this.activeEmbeddingIndexId();
    if (!activeIndexId) {
      return { embeddingIndexId: null, candidateCount: 0 };
    }

    const labels = this.listLabels();
    const evidence = this.evidenceSummaries(activeIndexId);
    const candidates: Array<{
      left: ClusterMergeDbRow;
      right: ClusterMergeDbRow;
      metrics: CandidateMetrics;
    }> = [];

    for (const polarity of ["positive", "negative"] as const) {
      const limit =
        polarity === "positive" ? POSITIVE_DIAGNOSTIC_LIMIT : NEGATIVE_DIAGNOSTIC_LIMIT;
      const clusters = this.listClusters({ embeddingIndexId: activeIndexId, polarity }).slice(0, limit);
      for (let leftIndex = 0; leftIndex < clusters.length; leftIndex += 1) {
        const left = clusters[leftIndex]!;
        for (let rightIndex = leftIndex + 1; rightIndex < clusters.length; rightIndex += 1) {
          const right = clusters[rightIndex]!;
          const metrics = metricsForPair({
            left,
            right,
            leftLabel: labels.get(left.id) ?? null,
            rightLabel: labels.get(right.id) ?? null,
            leftEvidence: evidence.get(left.id) ?? emptyEvidenceSummary(),
            rightEvidence: evidence.get(right.id) ?? emptyEvidenceSummary()
          });
          if (metrics.recommendation === "ignore") {
            continue;
          }
          candidates.push({ left, right, metrics });
        }
      }
    }

    const now = this.now();
    this.options.db.transaction(() => {
      this.options.db
        .prepare(
          "delete from interest_cluster_merge_candidates where embedding_index_id = ? and status = 'open'"
        )
        .run(activeIndexId);
      const insert = this.options.db.prepare(
        `
          insert into interest_cluster_merge_candidates (
            id,
            embedding_index_id,
            left_cluster_id,
            right_cluster_id,
            polarity,
            centroid_similarity,
            label_jaccard,
            evidence_overlap,
            representative_overlap,
            source_overlap,
            merge_score,
            recommendation,
            status,
            reason_json,
            created_at,
            updated_at,
            decided_at
          )
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, null)
          on conflict(left_cluster_id, right_cluster_id) do update set
            centroid_similarity = excluded.centroid_similarity,
            label_jaccard = excluded.label_jaccard,
            evidence_overlap = excluded.evidence_overlap,
            representative_overlap = excluded.representative_overlap,
            source_overlap = excluded.source_overlap,
            merge_score = excluded.merge_score,
            recommendation = excluded.recommendation,
            status = case
              when interest_cluster_merge_candidates.status in ('ignored', 'merged') then interest_cluster_merge_candidates.status
              else 'open'
            end,
            reason_json = excluded.reason_json,
            updated_at = excluded.updated_at,
            decided_at = case
              when interest_cluster_merge_candidates.status in ('ignored', 'merged') then interest_cluster_merge_candidates.decided_at
              else null
            end
        `
      );
      for (const candidate of candidates) {
        const [leftId, rightId] = orderedPair(candidate.left.id, candidate.right.id);
        insert.run(
          candidateId(activeIndexId, leftId, rightId),
          activeIndexId,
          leftId,
          rightId,
          candidate.left.polarity,
          roundMetric(candidate.metrics.centroidSimilarity),
          roundMetric(candidate.metrics.labelJaccard),
          roundMetric(candidate.metrics.evidenceOverlap),
          roundMetric(candidate.metrics.representativeOverlap),
          roundMetric(candidate.metrics.sourceOverlap),
          roundMetric(candidate.metrics.mergeScore),
          candidate.metrics.recommendation,
          JSON.stringify({
            generatedBy: INTEREST_CLUSTER_MERGE_DIAGNOSTICS_JOB_TYPE,
            metrics: candidate.metrics
          }),
          now,
          now
        );
      }
    })();

    return { embeddingIndexId: activeIndexId, candidateCount: candidates.length };
  }

  listCandidates(input: {
    status?: InterestClusterMergeCandidateStatus | "all";
    limit?: number;
  } = {}): InterestClusterMergeCandidateList {
    const activeIndexId = this.activeEmbeddingIndexId();
    if (!activeIndexId) {
      return { activeIndexId: null, candidates: [] };
    }
    const params: unknown[] = [activeIndexId];
    const statusClause =
      input.status && input.status !== "all"
        ? "and status = ?"
        : "";
    if (input.status && input.status !== "all") {
      params.push(input.status);
    }
    const limit = Math.max(1, Math.min(200, input.limit ?? 50));
    params.push(limit);
    const rows = this.options.db
      .prepare(
        `
          ${candidateSelect()}
          where embedding_index_id = ?
            ${statusClause}
          order by
            case status when 'open' then 0 when 'merged' then 1 when 'ignored' then 2 else 3 end,
            merge_score desc,
            updated_at desc
          limit ?
        `
      )
      .all(...params) as InterestClusterMergeCandidateRow[];
    return {
      activeIndexId,
      candidates: rows.map((candidate) => ({
        ...candidate,
        leftLabel: this.labelForCluster(candidate.leftClusterId),
        rightLabel: this.labelForCluster(candidate.rightClusterId)
      }))
    };
  }

  mergeCandidate(candidateIdValue: string): InterestClusterMergeResult {
    const candidate = this.findCandidate(candidateIdValue);
    if (!candidate) {
      throw new InterestClusterMergeServiceError(
        404,
        "NOT_FOUND",
        "Interest cluster merge candidate not found"
      );
    }
    if (candidate.status !== "open") {
      throw new InterestClusterMergeServiceError(
        409,
        "CANDIDATE_ALREADY_DECIDED",
        "Interest cluster merge candidate has already been decided",
        { status: candidate.status }
      );
    }
    if (candidate.recommendation !== "auto_merge" && candidate.recommendation !== "review") {
      throw new InterestClusterMergeServiceError(
        409,
        "CANDIDATE_NOT_MERGEABLE",
        "Interest cluster merge candidate is not recommended for merge"
      );
    }

    return this.mergeOpenCandidate(candidate);
  }

  ignoreCandidate(candidateIdValue: string): { ok: true; candidateId: string; status: "ignored" } {
    const candidate = this.findCandidate(candidateIdValue);
    if (!candidate) {
      throw new InterestClusterMergeServiceError(
        404,
        "NOT_FOUND",
        "Interest cluster merge candidate not found"
      );
    }
    if (candidate.status !== "open") {
      throw new InterestClusterMergeServiceError(
        409,
        "CANDIDATE_ALREADY_DECIDED",
        "Interest cluster merge candidate has already been decided",
        { status: candidate.status }
      );
    }

    const now = this.now();
    this.options.db
      .prepare(
        `
          update interest_cluster_merge_candidates
          set
            status = 'ignored',
            reason_json = ?,
            updated_at = ?,
            decided_at = ?
          where id = ?
        `
      )
      .run(
        JSON.stringify({
          decidedBy: "manual_ignore",
          previousReason: parseJsonObject(candidate.reasonJson)
        }),
        now,
        now,
        candidate.id
      );
    return { ok: true, candidateId: candidate.id, status: "ignored" };
  }

  autoMergeOpenCandidates(limit: number = AUTO_MERGE_LIMIT): {
    mergedCount: number;
    results: InterestClusterMergeResult[];
  } {
    const rows = this.options.db
      .prepare(
        `
          ${candidateSelect()}
          where status = 'open'
            and recommendation = 'auto_merge'
          order by merge_score desc, updated_at desc
          limit ?
        `
      )
      .all(Math.max(1, Math.min(AUTO_MERGE_LIMIT, limit))) as InterestClusterMergeCandidateRow[];
    const results: InterestClusterMergeResult[] = [];
    for (const candidate of rows) {
      try {
        results.push(this.mergeOpenCandidate(candidate));
      } catch {
        this.dismissCandidate(candidate.id, "auto_merge_failed_or_stale");
      }
    }
    return { mergedCount: results.length, results };
  }

  private mergeOpenCandidate(candidate: InterestClusterMergeCandidateRow): InterestClusterMergeResult {
    const left = this.findCluster(candidate.leftClusterId);
    const right = this.findCluster(candidate.rightClusterId);
    if (!left || !right) {
      this.dismissCandidate(candidate.id, "cluster_missing");
      throw new InterestClusterMergeServiceError(
        409,
        "CANDIDATE_STALE",
        "Interest cluster merge candidate refers to a missing cluster"
      );
    }
    if (
      left.embeddingIndexId !== right.embeddingIndexId ||
      left.embeddingIndexId !== candidate.embeddingIndexId ||
      left.polarity !== right.polarity ||
      left.polarity !== candidate.polarity
    ) {
      this.dismissCandidate(candidate.id, "cluster_mismatch");
      throw new InterestClusterMergeServiceError(
        409,
        "CANDIDATE_STALE",
        "Interest cluster merge candidate no longer matches cluster state"
      );
    }

    const labels = this.listLabels();
    const leftLabel = labels.get(left.id) ?? null;
    const rightLabel = labels.get(right.id) ?? null;
    const survivor = chooseSurvivor(left, right, leftLabel, rightLabel);
    const mergedAway = survivor.id === left.id ? right : left;
    const survivorLabel = labels.get(survivor.id) ?? null;
    const mergedAwayLabel = labels.get(mergedAway.id) ?? null;
    const survivorVector = fromVectorBlob(survivor.centroidVectorBlob);
    const mergedAwayVector = fromVectorBlob(mergedAway.centroidVectorBlob);
    const totalWeight = Math.max(survivor.weight + mergedAway.weight, 1);
    const centroid = normalizeVector(
      survivorVector.map(
        (value, index) =>
          (value * survivor.weight + (mergedAwayVector[index] ?? 0) * mergedAway.weight) /
          totalWeight
      )
    );
    const now = this.now();

    this.options.db.transaction(() => {
      this.options.db
        .prepare(
          `
            update interest_clusters
            set
              centroid_vector_blob = ?,
              weight = ?,
              sample_count = ?,
              last_matched_at = ?,
              updated_at = ?
            where id = ?
          `
        )
        .run(
          toVectorBlob(centroid),
          clamp(
            survivor.weight + mergedAway.weight,
            profileAlgorithmDefaults.minClusterWeight,
            profileAlgorithmDefaults.maxClusterWeight
          ),
          survivor.sampleCount + mergedAway.sampleCount,
          Math.max(survivor.lastMatchedAt ?? 0, mergedAway.lastMatchedAt ?? 0) || null,
          now,
          survivor.id
        );
      this.options.db
        .prepare("update interest_cluster_evidence set cluster_id = ? where cluster_id = ?")
        .run(survivor.id, mergedAway.id);
      if (!survivorLabel?.manualLabel && mergedAwayLabel?.manualLabel) {
        this.options.db
          .prepare(
            `
              insert into interest_cluster_labels (
                cluster_id,
                auto_label,
                manual_label,
                label_source,
                label_terms_json,
                representative_articles_json,
                feed_titles_json,
                label_diagnostics_json,
                confidence,
                generated_at,
                updated_at
              )
              values (?, null, ?, 'manual', null, null, null, null, 0, null, ?)
              on conflict(cluster_id) do update set
                manual_label = excluded.manual_label,
                label_source = 'manual',
                updated_at = excluded.updated_at
            `
          )
          .run(survivor.id, mergedAwayLabel.manualLabel, now);
      }
      this.options.db.prepare("delete from interest_clusters where id = ?").run(mergedAway.id);
      this.options.db
        .prepare(
          `
            update interest_cluster_merge_candidates
            set
              status = 'merged',
              reason_json = ?,
              updated_at = ?,
              decided_at = ?
            where id = ?
          `
        )
        .run(
          JSON.stringify({
            decidedBy: "merge",
            survivorClusterId: survivor.id,
            mergedAwayClusterId: mergedAway.id,
            metrics: {
              centroidSimilarity: candidate.centroidSimilarity,
              labelJaccard: candidate.labelJaccard,
              evidenceOverlap: candidate.evidenceOverlap,
              representativeOverlap: candidate.representativeOverlap,
              sourceOverlap: candidate.sourceOverlap,
              mergeScore: candidate.mergeScore,
              recommendation: candidate.recommendation
            },
            previousReason: parseJsonObject(candidate.reasonJson)
          }),
          now,
          now,
          candidate.id
        );
      this.options.db
        .prepare(
          `
            update interest_cluster_merge_candidates
            set
              status = 'dismissed',
              reason_json = ?,
              updated_at = ?,
              decided_at = ?
            where status = 'open'
              and id != ?
              and (
                left_cluster_id in (?, ?)
                or right_cluster_id in (?, ?)
              )
          `
        )
        .run(
          JSON.stringify({
            decidedBy: "merge",
            reason: "stale_after_related_cluster_merge",
            survivorClusterId: survivor.id,
            mergedAwayClusterId: mergedAway.id
          }),
          now,
          now,
          candidate.id,
          survivor.id,
          mergedAway.id,
          survivor.id,
          mergedAway.id
        );
    })();

    return {
      ok: true,
      candidateId: candidate.id,
      survivorClusterId: survivor.id,
      mergedAwayClusterId: mergedAway.id
    };
  }

  private dismissCandidate(candidateIdValue: string, reason: string): void {
    const now = this.now();
    this.options.db
      .prepare(
        `
          update interest_cluster_merge_candidates
          set
            status = 'dismissed',
            reason_json = ?,
            updated_at = ?,
            decided_at = ?
          where id = ?
            and status = 'open'
        `
      )
      .run(JSON.stringify({ decidedBy: "system", reason }), now, now, candidateIdValue);
  }

  private labelForCluster(clusterId: string): string {
    const cluster = this.findCluster(clusterId);
    if (!cluster) {
      return clusterId;
    }
    return this.options.clusterLabels.displayLabelForCluster(
      {
        id: cluster.id,
        label: cluster.label,
        polarity: cluster.polarity
      },
      1
    ).displayLabel;
  }

  private activeEmbeddingIndexId(): string | null {
    const row = this.options.db
      .prepare(
        `
          select ei.id
          from embedding_indexes ei
          join embedding_providers ep on ep.id = ei.provider_id
          where ep.enabled = 1
            and ei.status = 'active'
          order by ei.updated_at desc, ei.id
          limit 1
        `
      )
      .get() as { id: string } | undefined;
    return row?.id ?? null;
  }

  private listClusters(input: {
    embeddingIndexId: string;
    polarity?: InterestClusterPolarity;
  }): ClusterMergeDbRow[] {
    const rows = this.options.db
      .prepare(
        `
          ${clusterSelect()}
          where embedding_index_id = ?
            and (? is null or polarity = ?)
          order by weight desc, updated_at desc, id
        `
      )
      .all(input.embeddingIndexId, input.polarity ?? null, input.polarity ?? null) as ClusterMergeDbRow[];
    return rows;
  }

  private findCluster(clusterId: string): ClusterMergeDbRow | null {
    const row = this.options.db
      .prepare(
        `
          ${clusterSelect()}
          where id = ?
        `
      )
      .get(clusterId) as ClusterMergeDbRow | undefined;
    return row ?? null;
  }

  private findCandidate(candidateIdValue: string): InterestClusterMergeCandidateRow | null {
    const row = this.options.db
      .prepare(
        `
          ${candidateSelect()}
          where id = ?
        `
      )
      .get(candidateIdValue) as InterestClusterMergeCandidateRow | undefined;
    return row ?? null;
  }

  private listLabels(): Map<string, ClusterLabelRow> {
    const rows = this.options.db
      .prepare(
        `
          select
            cluster_id as clusterId,
            auto_label as autoLabel,
            manual_label as manualLabel,
            label_terms_json as labelTermsJson,
            representative_articles_json as representativeArticlesJson,
            feed_titles_json as feedTitlesJson
          from interest_cluster_labels
        `
      )
      .all() as ClusterLabelRow[];
    return new Map(rows.map((row) => [row.clusterId, row]));
  }

  private evidenceSummaries(embeddingIndexId: string): Map<string, ClusterEvidenceSummary> {
    const rows = this.options.db
      .prepare(
        `
          select
            ice.cluster_id as clusterId,
            ice.article_id as articleId,
            coalesce(ice.feed_id_snapshot, a.feed_id, '') as feedId,
            coalesce(ice.feed_title_snapshot, f.title, '') as feedTitle
          from interest_cluster_evidence ice
          join interest_clusters ic on ic.id = ice.cluster_id
          left join articles a on a.id = ice.article_id
          left join feeds f on f.id = coalesce(a.feed_id, ice.feed_id_snapshot)
          where ic.embedding_index_id = ?
        `
      )
      .all(embeddingIndexId) as Array<{
      clusterId: string;
      articleId: string;
      feedId: string;
      feedTitle: string;
    }>;
    const summaries = new Map<string, ClusterEvidenceSummary>();
    for (const row of rows) {
      const summary = summaries.get(row.clusterId) ?? emptyEvidenceSummary();
      summary.articleIds.add(row.articleId);
      if (row.feedId || row.feedTitle) {
        summary.feedKeys.add(row.feedId || row.feedTitle);
      }
      summaries.set(row.clusterId, summary);
    }
    return summaries;
  }
}

function metricsForPair(input: {
  left: ClusterMergeDbRow;
  right: ClusterMergeDbRow;
  leftLabel: ClusterLabelRow | null;
  rightLabel: ClusterLabelRow | null;
  leftEvidence: ClusterEvidenceSummary;
  rightEvidence: ClusterEvidenceSummary;
}): CandidateMetrics {
  const centroidSimilarity = cosineSimilarity(
    fromVectorBlob(input.left.centroidVectorBlob),
    fromVectorBlob(input.right.centroidVectorBlob)
  );
  const leftTerms = labelTerms(input.leftLabel);
  const rightTerms = labelTerms(input.rightLabel);
  const labelJaccard = jaccard(leftTerms, rightTerms);
  const evidenceOverlap = overlapMin(input.leftEvidence.articleIds, input.rightEvidence.articleIds);
  const representativeOverlap = overlapMin(
    representativeArticleIds(input.leftLabel),
    representativeArticleIds(input.rightLabel)
  );
  const sourceOverlap = overlapMin(input.leftEvidence.feedKeys, input.rightEvidence.feedKeys);
  const mergeScore =
    0.45 * centroidSimilarity +
    0.2 * labelJaccard +
    0.25 * evidenceOverlap +
    0.1 * representativeOverlap;
  const recommendation = recommendationFor({
    polarity: input.left.polarity,
    centroidSimilarity,
    labelJaccard,
    evidenceOverlap,
    mergeScore
  });

  return {
    centroidSimilarity,
    labelJaccard,
    evidenceOverlap,
    representativeOverlap,
    sourceOverlap,
    mergeScore,
    recommendation
  };
}

function recommendationFor(input: {
  polarity: InterestClusterPolarity;
  centroidSimilarity: number;
  labelJaccard: number;
  evidenceOverlap: number;
  mergeScore: number;
}): InterestClusterMergeRecommendation {
  if (input.polarity === "positive") {
    if (
      input.centroidSimilarity >= 0.93 &&
      (input.evidenceOverlap >= 0.35 || input.labelJaccard >= 0.65) &&
      input.mergeScore >= 0.8
    ) {
      return "auto_merge";
    }
    if (
      input.centroidSimilarity >= 0.88 &&
      (input.labelJaccard >= 0.5 || input.evidenceOverlap >= 0.2)
    ) {
      return "review";
    }
    return "ignore";
  }

  if (
    input.centroidSimilarity >= 0.95 &&
    (input.evidenceOverlap >= 0.45 || input.labelJaccard >= 0.75) &&
    input.mergeScore >= 0.86
  ) {
    return "auto_merge";
  }
  if (
    input.centroidSimilarity >= 0.92 &&
    (input.labelJaccard >= 0.6 || input.evidenceOverlap >= 0.3)
  ) {
    return "review";
  }
  return "ignore";
}

function chooseSurvivor(
  left: ClusterMergeDbRow,
  right: ClusterMergeDbRow,
  leftLabel: ClusterLabelRow | null,
  rightLabel: ClusterLabelRow | null
): ClusterMergeDbRow {
  if (leftLabel?.manualLabel && !rightLabel?.manualLabel) {
    return left;
  }
  if (rightLabel?.manualLabel && !leftLabel?.manualLabel) {
    return right;
  }
  if (left.weight !== right.weight) {
    return left.weight > right.weight ? left : right;
  }
  if (left.sampleCount !== right.sampleCount) {
    return left.sampleCount > right.sampleCount ? left : right;
  }
  return left.updatedAt >= right.updatedAt ? left : right;
}

function labelTerms(label: ClusterLabelRow | null): Set<string> {
  const terms = new Set<string>();
  for (const term of parseLabelTermsJson(label?.labelTermsJson ?? null)) {
    const normalized = normalizeTerm(term);
    if (normalized) {
      terms.add(normalized);
    }
  }
  if (terms.size === 0) {
    const fallbackTerms = [label?.manualLabel, label?.autoLabel]
      .filter((item): item is string => Boolean(item))
      .flatMap((item) => item.split("/"));
    for (const term of fallbackTerms) {
      const normalized = normalizeTerm(term);
      if (normalized) {
        terms.add(normalized);
      }
    }
  }
  return terms;
}

function parseLabelTermsJson(value: string | null): string[] {
  const parsed = parseJsonArray(value);
  return parsed
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }
      if (
        typeof item === "object" &&
        item !== null &&
        !Array.isArray(item) &&
        typeof (item as { term?: unknown }).term === "string"
      ) {
        return (item as { term: string }).term;
      }
      return null;
    })
    .filter((item): item is string => Boolean(item));
}

function representativeArticleIds(label: ClusterLabelRow | null): Set<string> {
  const ids = new Set<string>();
  for (const item of parseJsonArray(label?.representativeArticlesJson ?? null)) {
    if (
      typeof item === "object" &&
      item !== null &&
      !Array.isArray(item) &&
      typeof (item as { articleId?: unknown }).articleId === "string"
    ) {
      ids.add((item as { articleId: string }).articleId);
    }
  }
  return ids;
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 && right.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const item of left) {
    if (right.has(item)) {
      intersection += 1;
    }
  }
  return intersection / (left.size + right.size - intersection);
}

function overlapMin(left: Set<string>, right: Set<string>): number {
  const denominator = Math.min(left.size, right.size);
  if (denominator === 0) {
    return 0;
  }
  let intersection = 0;
  for (const item of left) {
    if (right.has(item)) {
      intersection += 1;
    }
  }
  return intersection / denominator;
}

function normalizeTerm(value: string): string {
  return value.trim().toLowerCase();
}

function emptyEvidenceSummary(): ClusterEvidenceSummary {
  return {
    articleIds: new Set(),
    feedKeys: new Set()
  };
}

function orderedPair(left: string, right: string): [string, string] {
  return left.localeCompare(right) <= 0 ? [left, right] : [right, left];
}

function candidateId(embeddingIndexId: string, leftClusterId: string, rightClusterId: string): string {
  return `cluster_merge_${createHash("sha256")
    .update(`${embeddingIndexId}:${leftClusterId}:${rightClusterId}`)
    .digest("hex")
    .slice(0, 24)}`;
}

function parseJsonArray(value: string | null): unknown[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value: string | null): Record<string, unknown> {
  if (!value) {
    return {};
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function roundMetric(value: number): number {
  return Number(value.toFixed(4));
}

function clusterSelect(): string {
  return `
    select
      id,
      embedding_index_id as embeddingIndexId,
      polarity,
      label,
      centroid_vector_blob as centroidVectorBlob,
      weight,
      sample_count as sampleCount,
      last_matched_at as lastMatchedAt,
      created_at as createdAt,
      updated_at as updatedAt
    from interest_clusters
  `;
}

function candidateSelect(): string {
  return `
    select
      id,
      embedding_index_id as embeddingIndexId,
      left_cluster_id as leftClusterId,
      right_cluster_id as rightClusterId,
      polarity,
      centroid_similarity as centroidSimilarity,
      label_jaccard as labelJaccard,
      evidence_overlap as evidenceOverlap,
      representative_overlap as representativeOverlap,
      source_overlap as sourceOverlap,
      merge_score as mergeScore,
      recommendation,
      status,
      reason_json as reasonJson,
      created_at as createdAt,
      updated_at as updatedAt,
      decided_at as decidedAt
    from interest_cluster_merge_candidates
  `;
}
