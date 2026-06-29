import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import * as SYS_MSG from '@constants/system-messages';
import { RequestRouting } from '@modules/requests/enums/request-routing.enum';
import { ToolRegistry } from '@modules/tools/registry';
import { scoringConfig } from '@config/scoring.config';
import { ScoreNode } from '../score.node';
import { ScorerService } from '../scorer.service';
import type { ScoringLineItem } from '../interfaces/scoring-input.interface';
import type { ScoringThresholds } from '../interfaces/scoring-thresholds.interface';

vi.mock('@config/scoring.config', () => ({
  scoringConfig: {
    autoThreshold: 0.95,
    unmatchedFloor: 0,
    policyFlagPenalty: 0.5,
    dealValueExceededPenalty: 0.8,
    autoSendCapMinor: 5000,
  },
}));

function line(overrides: Partial<ScoringLineItem> = {}): ScoringLineItem {
  return {
    matchConfidence: 0.95,
    unitPriceMinor: 1000,
    quantity: 1,
    hasFlags: false,
    ...overrides,
  };
}

describe('ScorerService', () => {
  const scorer = new ScorerService();
  const thresholds: ScoringThresholds = { autoThreshold: 0.95, autoSendCapMinor: 5000 };

  // ── Extraction failure path ──────────────────────────────────────────

  it('routes failed extraction to needs_review with extraction_failed reason', () => {
    const result = scorer.scoreExtractionFailure({ schema_valid: false });

    expect(result.routing).toBe(RequestRouting.NEEDS_REVIEW);
    expect(result.overallConfidence).toBe(0);
    expect(result.routingReasons).toEqual([
      {
        code: 'extraction_failed',
        message: SYS_MSG.EXTRACTION_ESCALATED,
        source: 'extraction',
      },
    ]);
  });

  it('routes empty-source extraction failure with extraction_empty_source reason', () => {
    const result = scorer.scoreExtractionFailure({
      schema_valid: false,
      raw_json: { failure_code: 'empty_source' },
    });

    expect(result.routing).toBe(RequestRouting.NEEDS_REVIEW);
    expect(result.routingReasons).toEqual([
      expect.objectContaining({ code: 'extraction_empty_source', source: 'extraction' }),
    ]);
  });

  it('routes null extraction to needs_review with extraction_failed reason', () => {
    const result = scorer.scoreExtractionFailure(null);

    expect(result.routing).toBe(RequestRouting.NEEDS_REVIEW);
    expect(result.overallConfidence).toBe(0);
    expect(result.routingReasons[0]?.code).toBe('extraction_failed');
  });

  // ── Aggregate scoring ────────────────────────────────────────────────

  it('routes a quote with one 64% line, no flags, under cap to needs_review (AC-01)', () => {
    const result = scorer.score([line({ matchConfidence: 0.64 })], thresholds);

    expect(result.overallConfidence).toBe(0.64);
    expect(result.routing).toBe(RequestRouting.NEEDS_REVIEW);
    expect(result.routingReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'low_line_confidence',
          source: 'confidence',
        }),
      ]),
    );
  });

  it('routes a quote with all high-confidence lines, no flags, under cap to priced (AC-02/AC-03)', () => {
    const result = scorer.score(
      [line({ matchConfidence: 0.99 }), line({ matchConfidence: 0.98 })],
      thresholds,
    );

    expect(result.overallConfidence).toBeGreaterThanOrEqual(scoringConfig.autoThreshold);
    expect(result.routing).toBe(RequestRouting.AUTO_ELIGIBLE);
    expect(result.routingReasons).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'auto_eligible' })]),
    );
  });

  it('reflects the minimum line confidence as overall_confidence', () => {
    const result = scorer.score(
      [
        line({ matchConfidence: 0.99 }),
        line({ matchConfidence: 0.64 }),
        line({ matchConfidence: 0.85 }),
      ],
      thresholds,
    );

    expect(result.overallConfidence).toBe(0.64);
    expect(result.routing).toBe(RequestRouting.NEEDS_REVIEW);
  });

  it('uses unmatched floor for lines with null match_confidence', () => {
    const result = scorer.score([line({ matchConfidence: null })], thresholds);

    expect(result.overallConfidence).toBe(scoringConfig.unmatchedFloor);
    expect(result.routing).toBe(RequestRouting.NEEDS_REVIEW);
  });

  it('handles all unmatched lines at floor -> needs_review (EC-01)', () => {
    const result = scorer.score(
      [line({ matchConfidence: null }), line({ matchConfidence: null })],
      thresholds,
    );

    expect(result.overallConfidence).toBe(scoringConfig.unmatchedFloor);
    expect(result.routing).toBe(RequestRouting.NEEDS_REVIEW);
    expect(result.routing).not.toBe(RequestRouting.AUTO_ELIGIBLE);
  });

  it('handles zero line items explicitly -> needs_review (EC-02)', () => {
    const result = scorer.score([], thresholds);

    expect(result.overallConfidence).toBe(0);
    expect(result.routing).toBe(RequestRouting.NEEDS_REVIEW);
    expect(result.routingReasons).toEqual([expect.objectContaining({ code: 'no_line_items' })]);
  });

  it('is deterministic for the same inputs (EC-03)', () => {
    const items = [line({ matchConfidence: 0.85 }), line({ matchConfidence: 0.92 })];

    const first = scorer.score(items, thresholds);
    const second = scorer.score(items, thresholds);
    expect(second).toEqual(first);
  });

  it('applies policy flag penalty when flags exist', () => {
    const result = scorer.score([line({ hasFlags: true, matchConfidence: 0.99 })], thresholds);

    expect(result.overallConfidence).toBe(scoringConfig.policyFlagPenalty);
    expect(result.routingReasons).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'policy_flags_detected' })]),
    );
  });

  it('applies deal value penalty when total exceeds cap', () => {
    const result = scorer.score(
      [line({ unitPriceMinor: 100000, quantity: 10, matchConfidence: 0.99 })],
      thresholds,
    );

    expect(result.overallConfidence).toBe(scoringConfig.dealValueExceededPenalty);
    expect(result.routingReasons).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'deal_value_exceeds_cap' })]),
    );
  });

  it('routes quote with incomplete pricing to review (fail-closed)', () => {
    const result = scorer.score(
      [
        line({ unitPriceMinor: 1000, quantity: 1, matchConfidence: 0.99 }),
        line({ unitPriceMinor: null, quantity: 1, matchConfidence: 0.99 }),
      ],
      thresholds,
    );

    expect(result.overallConfidence).toBe(scoringConfig.dealValueExceededPenalty);
    expect(result.routing).toBe(RequestRouting.NEEDS_REVIEW);
    expect(result.routingReasons).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'incomplete_deal_value' })]),
    );
  });

  it('routes a 0.92 quote needs_review at 0.95 but auto_eligible at 0.90 (AC-01)', () => {
    const items = [line({ matchConfidence: 0.92 })];

    const atDefault = scorer.score(items, { autoThreshold: 0.95, autoSendCapMinor: undefined });
    expect(atDefault.routing).toBe(RequestRouting.NEEDS_REVIEW);

    const lowered = scorer.score(items, { autoThreshold: 0.9, autoSendCapMinor: undefined });
    expect(lowered.overallConfidence).toBe(0.92);
    expect(lowered.routing).toBe(RequestRouting.AUTO_ELIGIBLE);
    expect(lowered.routingReasons).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'auto_eligible' })]),
    );
  });
});

describe('ScoreNode wiring', () => {
  it('does not accept ToolRegistry in its constructor (SEC-01)', () => {
    const paramTypes: unknown[] = Reflect.getMetadata('design:paramtypes', ScoreNode) ?? [];
    expect(paramTypes).not.toContain(ToolRegistry);
  });
});
