import { MatchMethod } from '../enums/match-method.enum';

export interface RrfLexicalHit {
  sku_id: string;
  sku_code: string;
  name: string;
  description: string | null;
  sim_score: number;
}

export interface RrfSemanticHit {
  sku_id: string;
  sku_code: string;
  name: string;
  description: string | null;
  sim_score: number;
}

export interface FusedCandidate {
  sku_id: string;
  sku_code: string;
  name: string;
  description: string | null;
  /** Confidence in [0, 1]: max(lexical_sim, semantic_sim) when both present; the single score otherwise. */
  score: number;
  match_method: MatchMethod;
}
