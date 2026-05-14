export const profileAlgorithmDefaults = {
  maxPositiveClusters: 24,
  maxNegativeClusters: 16,
  positiveMergeThreshold: 0.72,
  positiveCreateThreshold: 0.48,
  negativeMergeThreshold: 0.76,
  negativeCreateThreshold: 0.55,
  freshnessHalfLifeHours: 36
} as const;

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function freshnessScore(
  ageHours: number,
  maxScore = 0.18,
  halfLifeHours = profileAlgorithmDefaults.freshnessHalfLifeHours
) {
  return Math.exp(-ageHours / halfLifeHours) * maxScore;
}

