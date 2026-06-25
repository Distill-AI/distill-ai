import { MatchMethod } from '../enums/match-method.enum';

export interface SearchCatalogCandidate {
  sku_id: string;
  sku_code: string;
  name: string;
  description: string | null;
  score: number;
  rank: number;
  match_method: MatchMethod;
}

export interface SearchCatalogResult {
  candidates: SearchCatalogCandidate[];
  degraded: boolean;
}
