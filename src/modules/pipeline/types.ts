import { CurrentNode } from '@modules/requests/enums/current-node.enum';

/**
 * Core pipeline-engine types (US-E8-4).
 *
 * The graph walks the `CurrentNode` set (`parse -> ... -> score`, then `done`/`failed`).
 * Routing is deterministic: a pure function of the node result + persisted state, never the LLM.
 */

export interface ErrorInfo {
  message: string;
  code?: string;
}

/**
 * Outcome of running a single node. Discriminated on `kind`:
 * - `advance`  : move to `next` (a normal node, or `done` from the score node).
 * - `clarify`  : interrupt the run and wait for human-gated clarification.
 * - `failed`   : an infrastructure error; the run terminates as failed.
 */
export type NodeResult =
  | { kind: 'advance'; next: CurrentNode }
  | { kind: 'clarify' }
  | { kind: 'failed'; error: ErrorInfo };

/** Everything a node needs to run. Nodes read/write their own outputs via their own services. */
export interface NodeContext {
  requestId: string;
  orgId: string;
}

/** A pipeline node. `name` is its position in the graph; `run` performs the step. */
export interface PipelineNode {
  readonly name: CurrentNode;
  run(ctx: NodeContext): Promise<NodeResult>;
}

/**
 * The four V1 tools. `price`/`policy`/`score` are deliberately NOT tool names: the
 * deterministic/agentic boundary is enforced by this type (US-E4-3 / NFR-SEC-3).
 */
export const TOOL_NAMES = [
  'extract_request',
  'search_catalog',
  'render_quote_pdf',
  'explain_routing',
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];
