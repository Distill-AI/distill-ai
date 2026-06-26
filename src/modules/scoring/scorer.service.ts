import { Injectable } from '@nestjs/common';
import * as SYS_MSG from '@constants/system-messages';
import { EXTRACTION_FAILURE_EMPTY_SOURCE } from '@modules/extraction/constants';
import { RequestRouting } from '@modules/requests/enums/request-routing.enum';
import { scoringConfig } from '@config/scoring.config';
import type { ScoringResultDto } from './dto/scoring-result.dto';
import type { ScoringLineItem } from './interfaces/scoring-input.interface';

@Injectable()
export class ScorerService {
  score(lineItems: ScoringLineItem[]): ScoringResultDto {
    if (lineItems.length === 0) {
      return {
        routing: RequestRouting.NEEDS_REVIEW,
        overallConfidence: 0,
        routingReasons: [
          {
            code: 'no_line_items',
            message: SYS_MSG.SCORE_NO_LINE_ITEMS,
            source: 'confidence',
          },
        ],
      };
    }

    const lineConfidenceFactor = this.computeLineConfidenceFactor(lineItems);
    const policyComplianceFactor = this.computePolicyComplianceFactor(lineItems);
    const dealValueFactor = this.computeDealValueFactor(lineItems);

    const overallConfidence = Math.min(
      lineConfidenceFactor,
      policyComplianceFactor,
      dealValueFactor,
    );

    const routingReasons = this.buildReasons(
      lineItems,
      lineConfidenceFactor,
      policyComplianceFactor,
      dealValueFactor,
      overallConfidence,
    );

    const routing =
      overallConfidence >= scoringConfig.autoThreshold
        ? RequestRouting.AUTO_ELIGIBLE
        : RequestRouting.NEEDS_REVIEW;

    return { routing, overallConfidence, routingReasons };
  }

  /**
   * E2-3: fail closed when extraction is invalid.
   * Kept as a separate method for the extraction-failure path (not part of the
   * aggregate confidence formula). Returns needs_review with extraction reason.
   */
  scoreExtractionFailure(extraction: unknown | null): ScoringResultDto {
    return {
      routing: RequestRouting.NEEDS_REVIEW,
      overallConfidence: 0,
      routingReasons: [this.extractionFailureReason(extraction)],
    };
  }

  private computeLineConfidenceFactor(lineItems: ScoringLineItem[]): number {
    const minConfidence = Math.min(
      ...lineItems.map((li) =>
        li.matchConfidence !== null && li.matchConfidence !== undefined
          ? li.matchConfidence
          : scoringConfig.unmatchedFloor,
      ),
    );
    return Math.max(0, Math.min(1, minConfidence));
  }

  private computePolicyComplianceFactor(lineItems: ScoringLineItem[]): number {
    const hasFlags = lineItems.some((li) => li.hasFlags);
    return hasFlags ? scoringConfig.policyFlagPenalty : 1;
  }

  private computeDealValueFactor(lineItems: ScoringLineItem[]): number {
    const cap = scoringConfig.autoSendCapMinor;
    if (cap === undefined || cap <= 0) {
      return 1;
    }

    const hasIncomplete = lineItems.some(
      (li) => li.unitPriceMinor === null || li.quantity === null,
    );
    if (hasIncomplete) {
      return scoringConfig.dealValueExceededPenalty;
    }

    const total = lineItems.reduce((sum, li) => sum + li.unitPriceMinor! * li.quantity!, 0);

    if (total > cap) {
      return scoringConfig.dealValueExceededPenalty;
    }

    return 1;
  }

  private buildReasons(
    lineItems: ScoringLineItem[],
    lineConfidenceFactor: number,
    policyComplianceFactor: number,
    dealValueFactor: number,
    overallConfidence: number,
  ): { code: string; message: string; source: 'confidence' }[] {
    const reasons: { code: string; message: string; source: 'confidence' }[] = [];

    if (lineConfidenceFactor < scoringConfig.autoThreshold) {
      reasons.push({
        code: 'low_line_confidence',
        message: SYS_MSG.SCORE_BELOW_AUTO_THRESHOLD(
          lineConfidenceFactor,
          scoringConfig.autoThreshold,
        ),
        source: 'confidence',
      });
    }

    if (policyComplianceFactor < 1) {
      reasons.push({
        code: 'policy_flags_detected',
        message: SYS_MSG.SCORE_POLICY_FLAGS_DETECTED,
        source: 'confidence',
      });
    }

    if (dealValueFactor < 1) {
      const cap = scoringConfig.autoSendCapMinor ?? 0;
      const hasIncomplete = lineItems.some(
        (li) => li.unitPriceMinor === null || li.quantity === null,
      );

      if (hasIncomplete) {
        reasons.push({
          code: 'incomplete_deal_value',
          message: SYS_MSG.SCORE_DEAL_VALUE_INCOMPLETE,
          source: 'confidence',
        });
      } else {
        const total = lineItems.reduce((sum, li) => sum + li.unitPriceMinor! * li.quantity!, 0);
        reasons.push({
          code: 'deal_value_exceeds_cap',
          message: SYS_MSG.SCORE_DEAL_VALUE_EXCEEDS_CAP(total, cap),
          source: 'confidence',
        });
      }
    }

    if (overallConfidence >= scoringConfig.autoThreshold && reasons.length === 0) {
      reasons.push({
        code: 'auto_eligible',
        message: SYS_MSG.SCORE_AUTO_ELIGIBLE(overallConfidence),
        source: 'confidence',
      });
    }

    return reasons;
  }

  private extractionFailureReason(extraction: unknown | null): {
    code: string;
    message: string;
    source: 'extraction';
  } {
    if (
      extraction &&
      typeof extraction === 'object' &&
      'raw_json' in extraction &&
      (extraction as Record<string, unknown>).raw_json &&
      typeof (extraction as Record<string, unknown>).raw_json === 'object' &&
      'failure_code' in
        ((extraction as Record<string, unknown>).raw_json as Record<string, unknown>) &&
      ((extraction as Record<string, unknown>).raw_json as Record<string, unknown>).failure_code ===
        EXTRACTION_FAILURE_EMPTY_SOURCE
    ) {
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
