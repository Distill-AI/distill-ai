/**
 * Cache-aside TTL for computed explanations. The primary staleness control is active invalidation
 * from LineItemRemapActions after a recompute (see requests/actions/line-item-remap.actions.ts);
 * this is the backstop for a missed invalidation or a Redis restart.
 */
export const COPILOT_EXPLANATION_CACHE_TTL_S = 60 * 15;

/**
 * Shorter TTL for a degraded (template-fallback) result: the LLM was unavailable when this was
 * computed, so pin it for less time than a confident result to let a recovered LLM take over
 * sooner, while still absorbing repeated recomputation during a sustained outage.
 */
export const COPILOT_EXPLANATION_DEGRADED_CACHE_TTL_S = 60;

export function copilotExplanationCacheKey(requestId: string): string {
  return `copilot_explanation:${requestId}`;
}
