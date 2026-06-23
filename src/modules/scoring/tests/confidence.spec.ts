import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import * as SYS_MSG from '@constants/system-messages';
import { EXTRACTION_FAILURE_EMPTY_SOURCE } from '@modules/extraction/constants';
import type { Extraction } from '@modules/extraction/entities/extraction.entity';
import { ExtractionStatus } from '@modules/extraction/enums/extraction-status.enum';
import type { Request } from '@modules/requests/entities/request.entity';
import { RequestRouting } from '@modules/requests/enums/request-routing.enum';
import { ToolRegistry } from '@modules/tools/registry';
import { ScoreNode } from '../score.node';
import { ScorerService } from '../scorer.service';

const baseRequest = {
  classification_confidence: 0.5,
} as Request;

const validExtraction = {
  schema_valid: true,
  status: ExtractionStatus.COMPLETED,
} as Extraction;

describe('ScorerService', () => {
  const scorer = new ScorerService();

  it('routes failed extraction to needs_review with extraction_failed reason', () => {
    const result = scorer.score(baseRequest, {
      ...validExtraction,
      schema_valid: false,
      status: ExtractionStatus.FAILED,
    });

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

  it('routes empty-source failure to needs_review with extraction_empty_source reason', () => {
    const result = scorer.score(baseRequest, {
      ...validExtraction,
      schema_valid: false,
      status: ExtractionStatus.FAILED,
      raw_json: { failure_code: EXTRACTION_FAILURE_EMPTY_SOURCE },
    });

    expect(result.routing).toBe(RequestRouting.NEEDS_REVIEW);
    expect(result.routingReasons).toEqual([
      {
        code: 'extraction_empty_source',
        message: SYS_MSG.EXTRACTION_SOURCE_TEXT_EMPTY,
        source: 'extraction',
      },
    ]);
  });

  it('routes missing extraction to needs_review with extraction_failed reason', () => {
    const result = scorer.score(baseRequest, null);

    expect(result.routing).toBe(RequestRouting.NEEDS_REVIEW);
    expect(result.routingReasons[0]?.code).toBe('extraction_failed');
  });

  it('routes valid extraction to needs_review with empty reasons (E5 adds confidence routing)', () => {
    const result = scorer.score({ classification_confidence: 0.99 } as Request, validExtraction);

    expect(result.routing).toBe(RequestRouting.NEEDS_REVIEW);
    expect(result.overallConfidence).toBe(0.99);
    expect(result.routingReasons).toEqual([]);
  });

  it('is deterministic for the same inputs', () => {
    const first = scorer.score(baseRequest, validExtraction);
    const second = scorer.score(baseRequest, validExtraction);
    expect(second).toEqual(first);
  });
});

describe('ScoreNode wiring', () => {
  it('does not accept ToolRegistry in its constructor', () => {
    const paramTypes: unknown[] = Reflect.getMetadata('design:paramtypes', ScoreNode) ?? [];
    expect(paramTypes).not.toContain(ToolRegistry);
  });
});
