import {
  EVENT_PAYLOAD_SCHEMAS,
  NodeExitedPayloadSchema,
  PolicyCompletedPayloadSchema,
  PricingCompletedPayloadSchema,
  ProcessingCompletePayloadSchema,
  QuoteApprovedPayloadSchema,
  QuoteReadyPayloadSchema,
  RequestDeclinedPayloadSchema,
  RequestFinalizedPayloadSchema,
  RequestReceivedPayloadSchema,
  RequestResumedPayloadSchema,
  ToolInvokedPayloadSchema,
  NodeEnteredPayloadSchema,
} from '../events.constants';

describe('EVENT_PAYLOAD_SCHEMAS', () => {
  it('has an entry for every event name this codebase emits', () => {
    const expectedEventNames = [
      'request.received',
      'node.entered',
      'node.exited',
      'tool.invoked',
      'request.resumed',
      'stage.error',
      'quote.approved',
      'quote.ready',
      'request.declined',
      'pricing.completed',
      'policy.completed',
      'processing.complete',
      'request.finalized',
    ];
    expect(Object.keys(EVENT_PAYLOAD_SCHEMAS).sort()).toEqual(expectedEventNames.sort());
  });
});

describe.each([
  {
    name: 'request.received',
    schema: RequestReceivedPayloadSchema,
    valid: { channel: 'email', attachment_count: 2 },
    invalid: { channel: 'email' },
  },
  {
    name: 'node.entered',
    schema: NodeEnteredPayloadSchema,
    valid: {
      type: 'node.entered',
      timestamp: new Date().toISOString(),
      node: 'parse',
      status: 'processing',
    },
    invalid: { type: 'node.entered', timestamp: new Date().toISOString(), status: 'processing' },
  },
  {
    name: 'tool.invoked',
    schema: ToolInvokedPayloadSchema,
    valid: {
      type: 'tool.invoked',
      timestamp: new Date().toISOString(),
      tool_name: 'search_catalog',
      status: 'success',
      attempt: 1,
      result_summary: 'Found 3 results',
    },
    invalid: {
      type: 'tool.invoked',
      timestamp: new Date().toISOString(),
      status: 'success',
      attempt: 1,
      result_summary: 'Found 3 results',
    },
  },
  {
    name: 'request.resumed',
    schema: RequestResumedPayloadSchema,
    valid: { type: 'request.resumed', resumed_from_node: 'match', reason: 'crash_recovery' },
    invalid: { type: 'request.resumed', reason: 'crash_recovery' },
  },
  {
    name: 'quote.approved',
    schema: QuoteApprovedPayloadSchema,
    valid: {},
    invalid: { extra: 'field' },
  },
  {
    name: 'quote.ready',
    schema: QuoteReadyPayloadSchema,
    valid: {},
    invalid: { extra: 'field' },
  },
  {
    name: 'request.declined',
    schema: RequestDeclinedPayloadSchema,
    valid: { reason: 'Out of scope' },
    invalid: {},
  },
  {
    name: 'pricing.completed',
    schema: PricingCompletedPayloadSchema,
    valid: { node: 'price', next: 'policy', total_minor: 12_00, blocked: false, message: 'Priced' },
    invalid: { node: 'price', next: 'policy', blocked: false, message: 'Priced' },
  },
  {
    name: 'policy.completed',
    schema: PolicyCompletedPayloadSchema,
    valid: {
      node: 'policy',
      next: 'score',
      breached: false,
      fail_closed: false,
      breach_count: 0,
      message: 'OK',
    },
    invalid: { node: 'policy', next: 'score', breached: false, message: 'OK' },
  },
  {
    name: 'processing.complete',
    schema: ProcessingCompletePayloadSchema,
    valid: {
      type: 'processing.complete',
      timestamp: new Date().toISOString(),
      status: 'success',
      total_duration_ms: 1000,
    },
    invalid: {
      type: 'processing.complete',
      timestamp: new Date().toISOString(),
      status: 'success',
    },
  },
  {
    name: 'request.finalized',
    schema: RequestFinalizedPayloadSchema,
    valid: { status: 'priced' },
    invalid: {},
  },
])('$name schema', ({ schema, valid, invalid }) => {
  it('parses a valid payload', () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it('rejects a payload missing a required field', () => {
    expect(schema.safeParse(invalid).success).toBe(false);
  });
});

describe('NodeExitedPayloadSchema', () => {
  it('accepts the generic engine wrapper shape', () => {
    const result = NodeExitedPayloadSchema.safeParse({
      type: 'node.exited',
      timestamp: new Date().toISOString(),
      node: 'parse',
      status: 'success',
      duration_ms: 120,
      summary: 'Parsed email + attachments',
    });
    expect(result.success).toBe(true);
  });

  it('accepts the circuit-breaker-open minimal shape', () => {
    const result = NodeExitedPayloadSchema.safeParse({ node: 'classify', next: 'needs_review' });
    expect(result.success).toBe(true);
  });

  it('accepts the classify node shape', () => {
    const result = NodeExitedPayloadSchema.safeParse({
      node: 'classify',
      next: 'match',
      classification_type: 'catalog_rfq',
      classification_confidence: 0.92,
      elapsed_ms: 40,
      message: 'Classified as catalog_rfq (confidence: 92%)',
    });
    expect(result.success).toBe(true);
  });

  it('accepts the match node shape', () => {
    const result = NodeExitedPayloadSchema.safeParse({
      node: 'match',
      next: 'price',
      matched_count: 3,
      total_count: 5,
      degraded: false,
      message: 'Matched 3 of 5',
    });
    expect(result.success).toBe(true);
  });

  it('accepts the score node shape', () => {
    const result = NodeExitedPayloadSchema.safeParse({
      node: 'score',
      next: 'done',
      routing: 'auto_eligible',
      overall_confidence: 0.95,
      routing_reasons: [
        { code: 'high_confidence', message: 'All fields matched', source: 'confidence' },
      ],
      elapsed_ms: 10,
      message: 'Routed auto_eligible',
    });
    expect(result.success).toBe(true);
  });

  it('accepts the extract node shape', () => {
    const result = NodeExitedPayloadSchema.safeParse({
      node: 'extract',
      next: 'classify',
      schema_valid: true,
      reextract_count: 0,
      elapsed_ms: 200,
      message: 'Extraction completed',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a payload that matches none of the known shapes', () => {
    const result = NodeExitedPayloadSchema.safeParse({ node: 'parse', unexpected_field: true });
    expect(result.success).toBe(false);
  });
});
