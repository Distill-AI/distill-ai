/**
 * Cache-aside TTL for computed explanations. The primary staleness control is active invalidation
 * from LineItemRemapActions after a recompute (see requests/actions/line-item-remap.actions.ts);
 * this is the backstop for a missed invalidation or a Redis restart.
 */
export const COPILOT_EXPLANATION_CACHE_TTL_S = 60 * 15;

export function copilotExplanationCacheKey(requestId: string): string {
  return `copilot_explanation:${requestId}`;
}
