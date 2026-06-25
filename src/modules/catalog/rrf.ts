import { MatchMethod } from './enums/match-method.enum';
import type { FusedCandidate, RrfLexicalHit, RrfSemanticHit } from './interfaces/rrf.interfaces';

export type { FusedCandidate, RrfLexicalHit, RrfSemanticHit };

const DEFAULT_K = 60;

/** Fuse lexical and semantic hits with Reciprocal Rank Fusion (k=60 per TRD §5.5). */
export function fuseRrf(
  lexical: RrfLexicalHit[],
  semantic: RrfSemanticHit[],
  k: number = DEFAULT_K,
): FusedCandidate[] {
  if (!Number.isFinite(k) || k < 0) {
    throw new Error('RRF parameter k must be a finite number >= 0');
  }

  const scores = new Map<
    string,
    {
      sku_id: string;
      sku_code: string;
      name: string;
      description: string | null;
      rrfScore: number;
      lexicalSim: number | null;
      semanticSim: number | null;
    }
  >();

  for (let i = 0; i < lexical.length; i++) {
    const hit = lexical[i];
    const entry = scores.get(hit.sku_id);
    const contribution = 1 / (k + i + 1);
    if (entry) {
      entry.rrfScore += contribution;
      entry.lexicalSim = hit.sim_score;
    } else {
      scores.set(hit.sku_id, {
        sku_id: hit.sku_id,
        sku_code: hit.sku_code,
        name: hit.name,
        description: hit.description,
        rrfScore: contribution,
        lexicalSim: hit.sim_score,
        semanticSim: null,
      });
    }
  }

  for (let i = 0; i < semantic.length; i++) {
    const hit = semantic[i];
    const entry = scores.get(hit.sku_id);
    const contribution = 1 / (k + i + 1);
    if (entry) {
      entry.rrfScore += contribution;
      entry.semanticSim = hit.sim_score;
    } else {
      scores.set(hit.sku_id, {
        sku_id: hit.sku_id,
        sku_code: hit.sku_code,
        name: hit.name,
        description: hit.description,
        rrfScore: contribution,
        lexicalSim: null,
        semanticSim: hit.sim_score,
      });
    }
  }

  const sorted = [...scores.values()].sort((a, b) => b.rrfScore - a.rrfScore);

  return sorted.map((entry) => {
    let match_method: MatchMethod;
    let score: number;

    if (entry.lexicalSim !== null && entry.semanticSim !== null) {
      match_method = MatchMethod.FUSED;
      score = Math.max(entry.lexicalSim, entry.semanticSim);
    } else if (entry.lexicalSim !== null) {
      match_method = MatchMethod.FUZZY;
      score = entry.lexicalSim;
    } else {
      match_method = MatchMethod.SEMANTIC;
      score = entry.semanticSim!;
    }

    return {
      sku_id: entry.sku_id,
      sku_code: entry.sku_code,
      name: entry.name,
      description: entry.description,
      score,
      match_method,
    };
  });
}
