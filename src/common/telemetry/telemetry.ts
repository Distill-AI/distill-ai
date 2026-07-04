import { context, propagation, SpanStatusCode, trace, type Span } from '@opentelemetry/api';

const TRACER_NAME = 'distill-ai.pipeline';

/** Span attribute keys. Ids and timings only — never secrets or raw PII (SEC-01). */
export const ATTR_REQUEST_ID = 'distill.request_id';
export const ATTR_ORG_ID = 'distill.org_id';
export const ATTR_NODE = 'distill.node';
export const ATTR_TOOL = 'distill.tool_name';
export const ATTR_ATTEMPT = 'distill.attempt';

/** W3C context carried on a Bull job so the worker's spans chain into the API-side trace (EC-01). */
export interface TraceCarrier {
  traceparent?: string;
  tracestate?: string;
}

type Attrs = Record<string, string | number | null | undefined>;

/**
 * Runs `fn` inside an active span named `name`, stamping the given attributes (nulls skipped so a
 * missing request_id/org just omits the key). Records the exception and marks the span errored on
 * throw, then always ends it. The span carries `request_id` regardless of whether a parent trace
 * context is present, so a resumed run with no inbound context still emits a correlated span (EC-02).
 */
export async function withSpan<T>(
  name: string,
  attrs: Attrs,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return trace.getTracer(TRACER_NAME).startActiveSpan(name, async (span) => {
    for (const [key, value] of Object.entries(attrs)) {
      if (value != null) span.setAttribute(key, value);
    }
    try {
      return await fn(span);
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      throw err;
    } finally {
      span.end();
    }
  });
}

/** Serializes the active trace context into a carrier to attach to an outgoing Bull job. */
export function injectTraceContext(): TraceCarrier {
  const carrier: TraceCarrier = {};
  propagation.inject(context.active(), carrier);
  return carrier;
}

/** Runs `fn` with the trace context extracted from a Bull job carrier as the active context, so the
 * worker's spans become children of the API-side span (EC-01). A missing/blank carrier yields a
 * fresh root context, so the run still traces — just unlinked (EC-02). */
export function runWithTraceContext<T>(
  carrier: TraceCarrier | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const active = propagation.extract(context.active(), carrier ?? {});
  return context.with(active, fn);
}

/** trace_id / span_id of the active span, for stamping onto log lines (AC-02). */
export function activeTraceIds(): { trace_id: string; span_id: string } | undefined {
  const ctx = trace.getActiveSpan()?.spanContext();
  return ctx ? { trace_id: ctx.traceId, span_id: ctx.spanId } : undefined;
}
