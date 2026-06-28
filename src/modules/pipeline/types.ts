import { CurrentNode } from '@modules/requests/enums/current-node.enum';

/* -----------------------------------------------------------------
 *  Deterministic / agentic boundary – ToolName.
 *
 *  ToolName is a branded string that prevents reserved identifiers
 *  (price, policy, score) from being passed to invoke() at compile
 *  time.  Use toToolName() to create trusted values.
 * ----------------------------------------------------------------- */

export const RESERVED_NAMES = new Set(['price', 'policy', 'score']);

export type ToolName = string & { readonly __brand: unique symbol };

export function toToolName(name: string): ToolName {
  if (RESERVED_NAMES.has(name.toLowerCase())) {
    throw new Error(`'${name}' is a reserved tool name`);
  }
  return name as ToolName;
}

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

/**
 * Compile-time guarantee (US-E4-3 FR-2): the deterministic node names price/policy/score are
 * never tool names. If one were ever added to TOOL_NAMES, the `Extract` would no longer be
 * `never`, `_AssertDeterministicNotTool` would resolve to `false`, and the build would fail.
 */
type AssertTrue<T extends true> = T;
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- compile-time-only boundary assertion
type _AssertDeterministicNotTool = AssertTrue<
  Extract<(typeof TOOL_NAMES)[number], 'price' | 'policy' | 'score'> extends never ? true : false
>;
