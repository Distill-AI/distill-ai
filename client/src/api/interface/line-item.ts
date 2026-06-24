export interface MatchedLine {
  position: number;
  rawText: string;
  skuLabel: string | null;
  confidence: number | null;
}
