import { diag, DiagLogLevel, propagation } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchSpanProcessor,
  NodeTracerProvider,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { env } from '@config/env';

let started = false;

/**
 * Registers a global OpenTelemetry tracer provider and the W3C trace-context propagator for this
 * process (US-E7-1-OTEL). Runs unconditionally so spans and trace ids exist even with no collector
 * configured — that is what correlates a request's node/tool spans and log lines by trace id. Spans
 * are only exported over the wire when `OTEL_EXPORTER_OTLP_ENDPOINT` is set; otherwise they are
 * created and propagated in-process (still enough to link the trace and stamp logs). Skipped when
 * Sentry owns tracing (it registers its own OpenTelemetry provider), so the two never fight over the
 * global provider. Idempotent: both `main.ts` and `worker.ts` import `instrument`.
 */
export function initTracing(): void {
  if (started) return;
  started = true;

  // The propagator is what serializes trace context across the Bull job boundary (EC-01), so it is
  // registered regardless of whether spans are exported anywhere.
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());

  const spanProcessors: SpanProcessor[] = [];
  if (env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    diag.setLogger(
      { error: () => {}, warn: () => {}, info: () => {}, debug: () => {}, verbose: () => {} },
      DiagLogLevel.ERROR,
    );
    spanProcessors.push(
      new BatchSpanProcessor(
        new OTLPTraceExporter({ url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces` }),
      ),
    );
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
