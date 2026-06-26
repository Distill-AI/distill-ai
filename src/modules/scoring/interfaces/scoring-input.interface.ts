export interface ScoringLineItem {
  matchConfidence: number | null;
  unitPriceMinor: number | null;
  quantity: number | null;
  hasFlags: boolean;
}
