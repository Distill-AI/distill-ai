import { HttpStatus, Injectable } from '@nestjs/common';
import * as SYS_MSG from '@constants/system-messages';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import { LineItemModelAction } from '@modules/catalog/line-item.model-action';
import type { LineItem } from '@modules/catalog/entities/line-item.entity';
import { MANUAL_OVERRIDE_FLAG } from '@modules/pricing/quote-recompute.service';
import { RequestRouting } from '@modules/requests/enums/request-routing.enum';
import type { Request } from '@modules/requests/entities/request.entity';
import { ToolRegistry } from '@modules/tools/registry';
import { ToolStatus } from '@modules/tools/enums/tools.enums';
import { toToolName } from '@modules/pipeline/types';
import type { ExplainRoutingOutput } from '@modules/scoring/tools/explain-routing.tool';

// Excluded per HARD_REVIEW_FLAGS precedent in ScoreNode: neither flag forces the hard review gate,
// so neither belongs in the estimator-facing policy-flags explanation.
const CLOSE_TIE_FLAG = 'close_tie';

@Injectable()
export class CopilotService {
  constructor(
    private readonly lineItems: LineItemModelAction,
    private readonly toolRegistry: ToolRegistry,
  ) {}

  /** Returns the advisory routing explanation for a request; short-circuits to empty for non-needs_review requests. */
  async getExplanation(request: Request): Promise<ExplainRoutingOutput> {
    if (request.routing !== RequestRouting.NEEDS_REVIEW) {
      return { explanation: '', degraded: false };
    }

    const policyFlags = await this.aggregatePolicyFlags(request.id);

    const result = await this.toolRegistry.invoke(
      toToolName('explain_routing'),
      {
        routing: request.routing,
        overallConfidence: request.overall_confidence ?? 0,
        routingReasons: request.routing_reasons,
        policyFlags,
      },
      request.id,
    );

    if (result.status !== ToolStatus.OK) {
      throw new CustomHttpException(
        SYS_MSG.COPILOT_EXPLANATION_GENERATION_FAILED,
        HttpStatus.FAILED_DEPENDENCY,
      );
    }

    return result.result as ExplainRoutingOutput;
  }

  private async aggregatePolicyFlags(requestId: string): Promise<string[]> {
    const lineRows = await this.lineItems.list({
      filterRecordOptions: { request_id: requestId },
    });

    const flags = new Set<string>();
    for (const line of lineRows.payload as LineItem[]) {
      if (!Array.isArray(line.flags)) continue;
      for (const flag of line.flags as string[]) {
        if (flag === CLOSE_TIE_FLAG || flag === MANUAL_OVERRIDE_FLAG) continue;
        flags.add(flag);
      }
    }

    return [...flags];
  }
}
