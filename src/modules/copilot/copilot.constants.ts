/**
 * Cache-aside TTL for computed explanations. The primary staleness control is active invalidation
 * from LineItemRemapActions after a recompute (see requests/actions/line-item-remap.actions.ts);
 * this is the backstop for a missed invalidation or a Redis restart.
 */
export const COPILOT_EXPLANATION_CACHE_TTL_S = 60 * 15;

export function copilotExplanationCacheKey(requestId: string): string {
  return `copilot_explanation:${requestId}`;
}

/**
 * Stampede-protection lock: bounds how long one caller holds the "computing" lock for a given
 * request, covering typical explain_routing latency (single LLM call, no retries) with headroom
 * for a crashed holder to be reaped rather than block every other caller until TTL.
 */
export const COPILOT_EXPLANATION_LOCK_TTL_S = 30;

export function copilotExplanationLockKey(requestId: string): string {
  return `copilot_explanation_lock:${requestId}`;
}
