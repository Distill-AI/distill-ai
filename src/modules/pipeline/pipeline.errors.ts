/**
 * Pipeline error taxonomy (US-E8-4).
 *
 * Lives in its own module so graph nodes (ExtractNode, MatchNode, ... in M2) can throw
 * `PipelineInfraError` without importing from `graph.engine.ts` — a node must not depend on the
 * thing that drives it.
 */

/** Marker for infrastructure failures (DB/queue/network). Anything else is a recoverable logical error. */
export class PipelineInfraError extends Error {}

/**
 * Thrown when an LLM call is blocked because the circuit breaker is OPEN.
 *
 * Invariant: the thrower (LlmClientService.handleOpenBreaker) MUST emit a stage.error SSE event
 * with the appropriate reason before throwing. Catch-blocks that intercept this error MUST NOT
 * emit a second stage.error - doing so would produce duplicate SSE events on the stream.
 */
export class CircuitBreakerOpenError extends Error {
  constructor() {
    super('Circuit breaker is OPEN');
    this.name = 'CircuitBreakerOpenError';
  }
}

/** Infra errors fail the run; every other error escalates the request to human review. */
export function isInfraError(err: unknown): boolean {
  return err instanceof PipelineInfraError;
}
