import { propagation } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import {
  InMemorySpanExporter,
  NodeTracerProvider,
  SimpleSpanProcessor,
  type ReadableSpan,
} from '@opentelemetry/sdk-trace-node';
import {
  ATTR_NODE,
  ATTR_REQUEST_ID,
  ATTR_TOOL,
  injectTraceContext,
  runWithTraceContext,
  withSpan,
  type TraceCarrier,
} from '../telemetry';

const exporter = new InMemorySpanExporter();

beforeAll(() => {
  const provider = new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
  provider.register();
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
});

beforeEach(() => exporter.reset());

const parentSpanId = (span: ReadableSpan): string | undefined =>
  (span as ReadableSpan & { parentSpanContext?: { spanId: string }; parentSpanId?: string })
    .parentSpanContext?.spanId ?? (span as ReadableSpan & { parentSpanId?: string }).parentSpanId;

describe('withSpan', () => {
  it('nests node and tool spans in one trace, each carrying request_id (AC-01/AC-02)', async () => {
    await withSpan('pipeline.run', { [ATTR_REQUEST_ID]: 'req-1' }, () =>
      withSpan('node.classify', { [ATTR_REQUEST_ID]: 'req-1', [ATTR_NODE]: 'classify' }, () =>
        withSpan(
          'tool.catalog_search',
          { [ATTR_REQUEST_ID]: 'req-1', [ATTR_TOOL]: 'catalog_search' },
          async () => undefined,
        ),
      ),
    );

    const spans = exporter.getFinishedSpans();
    expect(spans.map((s) => s.name).sort()).toEqual([
      'node.classify',
      'pipeline.run',
      'tool.catalog_search',
    ]);
    // One continuous trace across the request's node and tool spans.
    expect(new Set(spans.map((s) => s.spanContext().traceId)).size).toBe(1);
    for (const span of spans) {
      expect(span.attributes[ATTR_REQUEST_ID]).toBe('req-1');
    }
    const byName = Object.fromEntries(spans.map((s) => [s.name, s]));
    expect(parentSpanId(byName['tool.catalog_search'])).toBe(
      byName['node.classify'].spanContext().spanId,
    );
    expect(parentSpanId(byName['node.classify'])).toBe(byName['pipeline.run'].spanContext().spanId);
  });

  it('marks the span errored and rethrows when the wrapped work throws', async () => {
    await expect(
      withSpan('node.match', { [ATTR_REQUEST_ID]: 'req-x' }, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const [span] = exporter.getFinishedSpans();
    expect(span.status.code).toBe(2); // SpanStatusCode.ERROR
  });
});

describe('trace context propagation across the Bull boundary', () => {
  it('links the worker run to the enqueue span via the serialized carrier (EC-01)', async () => {
    let carrier: TraceCarrier = {};
    await withSpan('pipeline.enqueue', { [ATTR_REQUEST_ID]: 'req-2' }, async () => {
      carrier = injectTraceContext();
    });
    expect(carrier.traceparent).toBeDefined();

    await runWithTraceContext(carrier, () =>
      withSpan('pipeline.run', { [ATTR_REQUEST_ID]: 'req-2' }, async () => undefined),
    );

    const spans = exporter.getFinishedSpans();
    // Enqueue (API) and run (worker) share one trace across the serialized carrier.
    expect(new Set(spans.map((s) => s.spanContext().traceId)).size).toBe(1);
    const run = spans.find((s) => s.name === 'pipeline.run')!;
    const enqueue = spans.find((s) => s.name === 'pipeline.enqueue')!;
    expect(parentSpanId(run)).toBe(enqueue.spanContext().spanId);
  });

  it('still emits a span with request_id when no context is carried (EC-02)', async () => {
    await runWithTraceContext(undefined, () =>
      withSpan('pipeline.run', { [ATTR_REQUEST_ID]: 'req-3' }, async () => undefined),
    );
    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0].attributes[ATTR_REQUEST_ID]).toBe('req-3');
    expect(parentSpanId(spans[0])).toBeUndefined(); // fresh root, unlinked but still traced
  });
});
