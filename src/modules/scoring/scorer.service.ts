import { Injectable } from '@nestjs/common';
import * as SYS_MSG from '@constants/system-messages';
import { EXTRACTION_FAILURE_EMPTY_SOURCE } from '@modules/extraction/constants';
import type { Extraction } from '@modules/extraction/entities/extraction.entity';
import type { Request } from '@modules/requests/entities/request.entity';
import { RequestRouting } from '@modules/requests/enums/request-routing.enum';
import type { RoutingReason } from './types/routing-reason';

export interface ScoringResult {
  routing: RequestRouting;
  overallConfidence: number;
  routingReasons: RoutingReason[];
}

@Injectable()
export class ScorerService {
  /**
   * E2-3: fail closed when extraction is invalid. Confidence-based auto-eligible routing is E5.
   */
  score(request: Request, extraction: Extraction | null): ScoringResult {
    if (!extraction?.schema_valid) {
      return {
        routing: RequestRouting.NEEDS_REVIEW,
        overallConfidence: 0,
        routingReasons: [this.extractionFailureReason(extraction)],
      };
    }

    return {
      routing: RequestRouting.NEEDS_REVIEW,
      overallConfidence: request.classification_confidence ?? 0,
      routingReasons: [],
    };
  }

  private extractionFailureReason(extraction: Extraction | null): RoutingReason {
    if (extraction?.raw_json?.failure_code === EXTRACTION_FAILURE_EMPTY_SOURCE) {
      return {
        code: 'extraction_empty_source',
        message: SYS_MSG.EXTRACTION_SOURCE_TEXT_EMPTY,
        source: 'extraction',
      };
    }

    return {
      code: 'extraction_failed',
      message: SYS_MSG.EXTRACTION_ESCALATED,
      source: 'extraction',
    };
  }
}
