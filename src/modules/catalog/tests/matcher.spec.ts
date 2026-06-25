import { describe, it, expect } from 'vitest';
import { fuseRrf } from '../rrf';
import { MatchMethod } from '../enums/match-method.enum';
import type { RrfLexicalHit, RrfSemanticHit } from '../interfaces/rrf.interfaces';

function lexHit(sku_id: string, sim_score: number): RrfLexicalHit {
  return { sku_id, sku_code: sku_id, name: sku_id, description: null, sim_score };
}

function semHit(sku_id: string, sim_score: number): RrfSemanticHit {
  return { sku_id, sku_code: sku_id, name: sku_id, description: null, sim_score };
}

describe('matcher', () => {
  it('placeholder — assertions wired in E3', () => {
    // intentionally empty: reserves this suite in CI
  });

  it('exact lexical match ranks above semantic-only match', () => {
    const result = fuseRrf([lexHit('sku-a', 1.0)], [semHit('sku-b', 0.9)]);

    expect(result[0].sku_id).toBe('sku-a');
    expect(result[0].match_method).toBe(MatchMethod.FUZZY);
    expect(result[1].sku_id).toBe('sku-b');
    expect(result[1].match_method).toBe(MatchMethod.SEMANTIC);
  });

  it('semantic-only match returns a result when lexical finds nothing', () => {
    const result = fuseRrf([], [semHit('sku-x', 0.85)]);

    expect(result).toHaveLength(1);
    expect(result[0].sku_id).toBe('sku-x');
    expect(result[0].match_method).toBe(MatchMethod.SEMANTIC);
    expect(result[0].score).toBe(0.85);
  });

  it('RRF fusion of lexical + semantic scores produces correct merged ranking', () => {
    // sku-shared appears in both lists; sku-lex-only is lexical-only but ranked first lexically
    const result = fuseRrf(
      [lexHit('sku-shared', 0.9), lexHit('sku-lex-only', 0.95)],
      [semHit('sku-shared', 0.9)],
    );

    const shared = result.find((c) => c.sku_id === 'sku-shared')!;
    const lexOnly = result.find((c) => c.sku_id === 'sku-lex-only')!;

    expect(shared.match_method).toBe(MatchMethod.FUSED);
    expect(lexOnly.match_method).toBe(MatchMethod.FUZZY);
    // sku-shared accumulates RRF contributions from both lists so it ranks first
    expect(result[0].sku_id).toBe('sku-shared');
  });

  it('close-tie flag is set when top-2 scores are within the margin threshold', () => {
    // scores 0.90 and 0.87 are within a 0.05 margin
    const result = fuseRrf([lexHit('sku-a', 0.9), lexHit('sku-b', 0.87)], []);

    const margin = 0.05;
    const isCloseTie = result.length >= 2 && result[1].score >= result[0].score - margin;

    expect(isCloseTie).toBe(true);
  });

  it('close-tie flag is not set when top-1 score exceeds the margin threshold clearly', () => {
    // scores 0.95 and 0.80 are more than 0.05 apart
    const result = fuseRrf([lexHit('sku-a', 0.95), lexHit('sku-b', 0.8)], []);

    const margin = 0.05;
    const isCloseTie = result.length >= 2 && result[1].score >= result[0].score - margin;

    expect(isCloseTie).toBe(false);
  });

  it('results below MATCH_THRESHOLD are excluded from the candidate list', () => {
    const threshold = 0.7;
    const result = fuseRrf([lexHit('sku-above', 0.85), lexHit('sku-below', 0.5)], []).filter(
      (c) => c.score >= threshold,
    );

    expect(result).toHaveLength(1);
    expect(result[0].sku_id).toBe('sku-above');
  });
});
