export interface ConfidenceThresholds {
  autoThreshold: number;
  matchThreshold: number;
}

export const DEFAULT_THRESHOLDS: ConfidenceThresholds = {
  autoThreshold: 0.95,
  matchThreshold: 0.7,
};

export type ConfidenceTier = 'hi' | 'md' | 'lo';

/** Classifies a 0-1 confidence fraction into a tier using the given thresholds. */
export function classifyTier(
  value: number,
  thresholds: ConfidenceThresholds = DEFAULT_THRESHOLDS,
): ConfidenceTier {
  if (value >= thresholds.autoThreshold) return 'hi';
  if (value >= thresholds.matchThreshold) return 'md';
  return 'lo';
}
