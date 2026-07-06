import { tool } from 'langchain';
import { z } from 'zod';
import { ToolRegistry } from '@modules/tools/registry';
import { ToolStatus } from '@modules/tools/enums/tools.enums';
import { toToolName } from '@modules/pipeline/types';
import type { ExplainRoutingToolInput } from '../copilot.utils';

const SearchCatalogAgentInputSchema = z.object({
  query: z.string().min(1).describe('Search text describing the SKU to find'),
  limit: z.number().int().min(1).max(20).default(5).describe('Max number of candidates to return'),
});

export interface AgenticCopilotToolContext {
  requestId: string;
  orgId: string;
  explainRoutingInput: ExplainRoutingToolInput;
}

/**
 * Builds the two LangChain tools the agentic copilot can call for one request.
 *
 * `orgId` is injected here rather than exposed in the LLM-facing schema (unlike the underlying
 * search_catalog ToolContract, whose schema takes orgId as a caller argument) - letting free-text
 * user input steer which org's catalog gets searched would be a cross-tenant data leak. Likewise
 * explain_routing takes no LLM-supplied arguments: its real input (routing/routingReasons/
 * policyFlags) is assembled server-side from the request record, since a free-text question has
 * no way to know internal routing codes.
 */
export function buildAgenticCopilotTools(
  toolRegistry: ToolRegistry,
  ctx: AgenticCopilotToolContext,
) {
  const searchCatalog = tool(
    async ({ query, limit }: z.infer<typeof SearchCatalogAgentInputSchema>) => {
      const result = await toolRegistry.invoke(
        toToolName('search_catalog'),
        { query, orgId: ctx.orgId, limit },
        ctx.requestId,
        1,
        ctx.orgId,
      );
      if (result.status !== ToolStatus.OK) {
        throw new Error(result.error ?? 'search_catalog failed');
      }
      return result.result;
    },
    {
      name: 'search_catalog',
      description:
        "Search the SKU catalog using lexical and semantic retrieval, scoped to the current request's organization.",
      schema: SearchCatalogAgentInputSchema,
    },
  );

  const explainRouting = tool(
    async () => {
      const result = await toolRegistry.invoke(
        toToolName('explain_routing'),
        ctx.explainRoutingInput,
        ctx.requestId,
        1,
        ctx.orgId,
      );
      if (result.status !== ToolStatus.OK) {
        throw new Error(result.error ?? 'explain_routing failed');
      }
      return result.result;
    },
    {
      name: 'explain_routing',
      description:
        'Explains why the current request was routed to auto-eligible or needs review. Takes no arguments.',
      schema: z.object({}),
    },
  );

  return [searchCatalog, explainRouting];
}
