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
