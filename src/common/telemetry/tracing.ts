import { propagation } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ConsoleSpanExporter,
  NodeTracerProvider,
  SimpleSpanProcessor,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { env } from '@config/env';

let started = false;

/**
 * Registers a global, always-on OpenTelemetry tracer provider and the W3C trace-context propagator
 * for this process (US-E7-1-OTEL). Runs unconditionally so a request's node/tool spans and log lines
 * share a real trace id for correlation even with no telemetry backend wired. When `OTEL_TRACE_CONSOLE`
 * is set the spans are also printed to stdout for local inspection; production export is layered on
 * externally via the standard OpenTelemetry SDK/collector, which consumes these same spans. Idempotent:
 * both `main.ts` and `worker.ts` import `instrument`.
 */
export function initTracing(): void {
  if (started) return;
  started = true;

  // The propagator is what serializes trace context across the Bull job boundary (EC-01), so it is
  // registered regardless of whether spans are exported anywhere.
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());

  const spanProcessors: SpanProcessor[] = [];
  if (env.OTEL_TRACE_CONSOLE) {
    // Pure-JS exporter (no native deps) — a safe way to see the request's trace tree locally.
    spanProcessors.push(new SimpleSpanProcessor(new ConsoleSpanExporter()));
  }

  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.SERVICE_NAME ?? 'distill-ai',
    }),
    spanProcessors,
  });
  // register() installs it as the global provider and the async-hooks context manager, so
  // `context.active()` follows async work across nodes and tool calls.
  provider.register();
}
