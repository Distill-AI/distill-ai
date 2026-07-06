import type { LineItem } from '@modules/catalog/entities/line-item.entity';
import { CLOSE_TIE_FLAG, MANUAL_OVERRIDE_FLAG } from '@modules/catalog/line-item-flags.constants';
import type { LineItemModelAction } from '@modules/catalog/line-item.model-action';
import type { RequestRouting } from '@modules/requests/enums/request-routing.enum';
import type { Request } from '@modules/requests/entities/request.entity';
import type { RoutingReason } from '@modules/requests/types/routing-reason';

/**
 * Loosely-typed mirror of explain_routing's Zod-inferred input: `Request.routing` can be null
 * (not yet scored) and `RoutingReason.code` is a plain string on the entity, stricter
 * (`RoutingReasonCode`) only at the tool boundary. `ToolRegistry.invoke()`'s `rawArgs` param is
 * `unknown`, so Zod validates this at runtime; this type just describes what we hand it.
 */
export interface ExplainRoutingToolInput {
  routing: RequestRouting | null;
  overallConfidence: number;
  routingReasons: RoutingReason[];
  policyFlags: string[];
}

/** Aggregates line-item policy flags for a request, excluding presentational-only flags
 * (close_tie, manual_override) and de-duplicating. Shared by CopilotService and AgenticCopilotService. */
export async function aggregatePolicyFlags(
  lineItems: LineItemModelAction,
  requestId: string,
): Promise<string[]> {
  const lineRows = await lineItems.list({
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

/** Assembles the explain_routing tool's input from a request and its aggregated policy flags. */
export function buildExplainRoutingInput(
  request: Request,
  policyFlags: string[],
): ExplainRoutingToolInput {
  return {
    routing: request.routing,
    overallConfidence: request.overall_confidence ?? 0,
    routingReasons: request.routing_reasons,
    policyFlags,
  };
}
