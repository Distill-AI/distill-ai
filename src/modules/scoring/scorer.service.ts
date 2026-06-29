import { Injectable } from '@nestjs/common';
import * as SYS_MSG from '@constants/system-messages';
import { EXTRACTION_FAILURE_EMPTY_SOURCE } from '@modules/extraction/constants';
import { RequestRouting } from '@modules/requests/enums/request-routing.enum';
import { scoringConfig } from '@config/scoring.config';
import type { ScoringResultDto } from './dto/scoring-result.dto';
import type { ScoringLineItem } from './interfaces/scoring-input.interface';
import type { ScoringThresholds } from './interfaces/scoring-thresholds.interface';
import type { Extraction } from '@modules/extraction/entities/extraction.entity';

@Injectable()
export class ScorerService {
  score(lineItems: ScoringLineItem[], thresholds: ScoringThresholds): ScoringResultDto {
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
    const {
      factor: dealValueFactor,
      cap,
      hasIncomplete,
      total,
    } = this.computeDealValueFactor(lineItems, thresholds.autoSendCapMinor);

    const overallConfidence = Math.min(
      lineConfidenceFactor,
      policyComplianceFactor,
      dealValueFactor,
    );

    const routingReasons = this.buildReasons(
      lineConfidenceFactor,
      policyComplianceFactor,
      dealValueFactor,
      overallConfidence,
      cap,
      hasIncomplete,
      total,
      thresholds.autoThreshold,
    );

    const routing =
      overallConfidence >= thresholds.autoThreshold
        ? RequestRouting.AUTO_ELIGIBLE
        : RequestRouting.NEEDS_REVIEW;

    return { routing, overallConfidence, routingReasons };
  }

  /**
   * E2-3: fail closed when extraction is invalid.
   * Kept as a separate method for the extraction-failure path (not part of the
   * aggregate confidence formula). Returns needs_review with extraction reason.
   */
  scoreExtractionFailure(extraction: Partial<Extraction> | null): ScoringResultDto {
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

  private computeDealValueFactor(
    lineItems: ScoringLineItem[],
    autoSendCapMinor: number | undefined,
  ): {
    factor: number;
    cap: number | undefined;
    hasIncomplete: boolean;
    total: number;
  } {
    const cap = autoSendCapMinor;
    if (cap === undefined) {
      return { factor: 1, cap, hasIncomplete: false, total: 0 };
    }

    const hasIncomplete = lineItems.some(
      (li) => li.unitPriceMinor === null || li.quantity === null,
    );
    if (hasIncomplete) {
      return {
        factor: scoringConfig.dealValueExceededPenalty,
        cap,
        hasIncomplete,
        total: 0,
      };
    }

    const total = lineItems.reduce((sum, li) => sum + li.unitPriceMinor! * li.quantity!, 0);
    if (total > cap) {
      return { factor: scoringConfig.dealValueExceededPenalty, cap, hasIncomplete, total };
    }

    return { factor: 1, cap, hasIncomplete, total };
  }

  private buildReasons(
    lineConfidenceFactor: number,
    policyComplianceFactor: number,
    dealValueFactor: number,
    overallConfidence: number,
    cap: number | undefined,
    hasIncomplete: boolean,
    total: number,
    autoThreshold: number,
  ): { code: string; message: string; source: 'confidence' }[] {
    const reasons: { code: string; message: string; source: 'confidence' }[] = [];

    if (lineConfidenceFactor < autoThreshold) {
      reasons.push({
        code: 'low_line_confidence',
        message: SYS_MSG.SCORE_BELOW_AUTO_THRESHOLD(lineConfidenceFactor, autoThreshold),
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
      if (hasIncomplete) {
        reasons.push({
          code: 'incomplete_deal_value',
          message: SYS_MSG.SCORE_DEAL_VALUE_INCOMPLETE,
          source: 'confidence',
        });
      } else {
        reasons.push({
          code: 'deal_value_exceeds_cap',
          message: SYS_MSG.SCORE_DEAL_VALUE_EXCEEDS_CAP(total, cap ?? 0),
          source: 'confidence',
        });
      }
    }

    if (overallConfidence >= autoThreshold && reasons.length === 0) {
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
