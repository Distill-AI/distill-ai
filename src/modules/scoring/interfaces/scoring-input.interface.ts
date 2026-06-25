export interface ScoringLineItem {
  matchConfidence: number | null;
  unitPriceMinor: number | null;
  quantity: number | null;
  hasFlags: boolean;
}

export interface ScoringConfig {
  autoThreshold: number;
  unmatchedFloor: number;
  policyFlagPenalty: number;
  dealValueExceededPenalty: number;
  autoSendCapMinor: number | undefined;
}
