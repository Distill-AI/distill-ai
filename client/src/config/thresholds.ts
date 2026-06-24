export interface ConfidenceThresholds {
  autoThreshold: number;
  matchThreshold: number;
}

export const DEFAULT_THRESHOLDS: ConfidenceThresholds = {
  autoThreshold: 0.95,
  matchThreshold: 0.7,
};
