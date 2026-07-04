import { z } from 'zod';
import { CurrentNode } from '@modules/requests/enums/current-node.enum';
import { RequestChannel } from '@modules/requests/enums/request-channel.enum';
import { RequestRouting } from '@modules/requests/enums/request-routing.enum';
import { RequestStatus } from '@modules/requests/enums/request-status.enum';
import { RequestType } from '@modules/requests/enums/request-type.enum';
import { ResumeReason } from '@modules/requests/enums/resume-reason.enum';
import { StreamNode } from '@modules/requests/enums/stream-node.enum';

export const STAGE_NAMES = [
  'parse',
  'extract',
  'classify',
  'match',
  'price',
  'policy',
  'score',
] as const;
export type StageName = (typeof STAGE_NAMES)[number];

export const StageErrorReason = {
  CORRUPT: 'corrupt',
  NO_TEXT_LAYER: 'no_text_layer',
  UNSUPPORTED_FORMAT: 'unsupported_format',
  SIZE_LIMIT_EXCEEDED: 'size_limit_exceeded',
  TOOL_NOT_FOUND: 'tool_not_found',
  TOOL_INPUT_INVALID: 'tool_input_invalid',
  TOOL_EXECUTION_FAILED: 'tool_execution_failed',
  TOOL_OUTPUT_INVALID: 'tool_output_invalid',
  LLM_CIRCUIT_OPEN: 'llm_circuit_open',
  LLM_TIMEOUT: 'llm_timeout',
  LLM_ERROR: 'llm_error',
  VECTOR_STORE_UNAVAILABLE: 'vector_store_unavailable',
  PRICING_RULE_MISSING: 'pricing_rule_missing',
  UNKNOWN: 'unknown',
} as const;
export type StageErrorReasonValue = (typeof StageErrorReason)[keyof typeof StageErrorReason];

export const StageErrorPayloadSchema = z.object({
  event_type: z.literal('stage.error'),
  request_id: z.string().uuid(),
  stage: z.enum(STAGE_NAMES),
  reason: z.enum(
    Object.values(StageErrorReason) as [StageErrorReasonValue, ...StageErrorReasonValue[]],
  ),
  escalated_to_human: z.literal(true),
  occurred_at: z.string().datetime(),
});

export type StageErrorPayload = z.infer<typeof StageErrorPayloadSchema>;

export const RequestReceivedPayloadSchema = z
  .object({
    channel: z.nativeEnum(RequestChannel),
    attachment_count: z.number().int().nonnegative(),
  })
  .strict();
export type RequestReceivedPayload = z.infer<typeof RequestReceivedPayloadSchema>;

export const NodeEnteredPayloadSchema = z
  .object({
    type: z.literal('node.entered'),
    timestamp: z.string().datetime(),
    node: z.nativeEnum(CurrentNode),
    status: z.literal('processing'),
  })
  .strict();
export type NodeEnteredPayload = z.infer<typeof NodeEnteredPayloadSchema>;

/**
 * `node.exited` is emitted from two independent places for the same node transition: the node's
 * own implementation (rich, node-specific attributes) and graph.engine.ts's generic wrapper
 * (type/timestamp/status/duration_ms/summary). A circuit-breaker-open path emits a third, minimal
 * shape. All three are real, concurrently-occurring production shapes, so the schema is a union
 * rather than a single object.
 */
const NodeExitedGenericSchema = z
  .object({
    type: z.literal('node.exited'),
    timestamp: z.string().datetime(),
    node: z.nativeEnum(CurrentNode),
    status: z.enum(['success', 'failed']),
    duration_ms: z.number().int().nonnegative(),
    summary: z.string(),
  })
  .strict();

const NodeExitedCircuitBreakerSchema = z
  .object({
    node: z.nativeEnum(CurrentNode),
    next: z.literal('needs_review'),
  })
  .strict();

const NodeExitedClassifySchema = z
  .object({
    node: z.nativeEnum(CurrentNode),
    next: z.nativeEnum(CurrentNode),
    classification_type: z.nativeEnum(RequestType),
    classification_confidence: z.number(),
    elapsed_ms: z.number().int().nonnegative(),
    message: z.string(),
  })
  .strict();

const NodeExitedMatchSchema = z
  .object({
    node: z.nativeEnum(CurrentNode),
    next: z.nativeEnum(CurrentNode),
    matched_count: z.number().int().nonnegative(),
    total_count: z.number().int().nonnegative(),
    degraded: z.boolean(),
    message: z.string(),
  })
  .strict();

const RoutingReasonSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    source: z.enum(['extraction', 'confidence', 'policy']),
  })
  .strict();

const NodeExitedScoreSchema = z
  .object({
    node: z.nativeEnum(CurrentNode),
    next: z.nativeEnum(CurrentNode),
    routing: z.nativeEnum(RequestRouting),
    overall_confidence: z.number(),
    routing_reasons: z.array(RoutingReasonSchema),
    elapsed_ms: z.number().int().nonnegative(),
    message: z.string(),
  })
  .strict();

const NodeExitedExtractSchema = z
  .object({
    node: z.nativeEnum(CurrentNode),
    next: z.nativeEnum(CurrentNode),
    schema_valid: z.boolean(),
    reextract_count: z.number().int().nonnegative(),
    elapsed_ms: z.number().int().nonnegative(),
    message: z.string(),
  })
  .strict();

export const NodeExitedPayloadSchema = z.union([
  NodeExitedGenericSchema,
  NodeExitedCircuitBreakerSchema,
  NodeExitedClassifySchema,
  NodeExitedMatchSchema,
  NodeExitedScoreSchema,
  NodeExitedExtractSchema,
]);
export type NodeExitedPayload = z.infer<typeof NodeExitedPayloadSchema>;

export const ToolInvokedPayloadSchema = z
  .object({
    type: z.literal('tool.invoked'),
    timestamp: z.string().datetime(),
    node: z.nativeEnum(StreamNode).optional(),
    tool_name: z.string(),
    status: z.enum(['running', 'success', 'failed']),
    attempt: z.number().int().positive(),
    result_summary: z.string(),
  })
  .strict();
export type ToolInvokedPayload = z.infer<typeof ToolInvokedPayloadSchema>;

export const RequestResumedPayloadSchema = z
  .object({
    type: z.literal('request.resumed'),
    resumed_from_node: z.nativeEnum(CurrentNode),
    reason: z.nativeEnum(ResumeReason),
  })
  .strict();
export type RequestResumedPayload = z.infer<typeof RequestResumedPayloadSchema>;

export const QuoteApprovedPayloadSchema = z.object({}).strict();
export type QuoteApprovedPayload = z.infer<typeof QuoteApprovedPayloadSchema>;

export const QuoteReadyPayloadSchema = z.object({}).strict();
export type QuoteReadyPayload = z.infer<typeof QuoteReadyPayloadSchema>;

export const RequestDeclinedPayloadSchema = z
  .object({
    reason: z.string(),
  })
  .strict();
export type RequestDeclinedPayload = z.infer<typeof RequestDeclinedPayloadSchema>;

export const PricingCompletedPayloadSchema = z
  .object({
    node: z.nativeEnum(CurrentNode),
    next: z.nativeEnum(CurrentNode),
    total_minor: z.number().int(),
    blocked: z.boolean(),
    message: z.string(),
  })
  .strict();
export type PricingCompletedPayload = z.infer<typeof PricingCompletedPayloadSchema>;

export const PolicyCompletedPayloadSchema = z
  .object({
    node: z.nativeEnum(CurrentNode),
    next: z.nativeEnum(CurrentNode),
    breached: z.boolean(),
    fail_closed: z.boolean(),
    breach_count: z.number().int().nonnegative(),
    message: z.string(),
  })
  .strict();
export type PolicyCompletedPayload = z.infer<typeof PolicyCompletedPayloadSchema>;

export const ProcessingCompletePayloadSchema = z
  .object({
    type: z.literal('processing.complete'),
    timestamp: z.string().datetime(),
    status: z.enum(['success', 'failed']),
    total_duration_ms: z.number().int().nonnegative(),
  })
  .strict();
export type ProcessingCompletePayload = z.infer<typeof ProcessingCompletePayloadSchema>;

export const RequestFinalizedPayloadSchema = z
  .object({
    status: z.nativeEnum(RequestStatus),
  })
  .strict();
export type RequestFinalizedPayload = z.infer<typeof RequestFinalizedPayloadSchema>;

/** Every domain event name mapped to the Zod schema its `attributes` must satisfy before write. */
export const EVENT_PAYLOAD_SCHEMAS: Record<string, z.ZodTypeAny> = {
  'request.received': RequestReceivedPayloadSchema,
  'node.entered': NodeEnteredPayloadSchema,
  'node.exited': NodeExitedPayloadSchema,
  'tool.invoked': ToolInvokedPayloadSchema,
  'request.resumed': RequestResumedPayloadSchema,
  'stage.error': StageErrorPayloadSchema,
  'quote.approved': QuoteApprovedPayloadSchema,
  'quote.ready': QuoteReadyPayloadSchema,
  'request.declined': RequestDeclinedPayloadSchema,
  'pricing.completed': PricingCompletedPayloadSchema,
  'policy.completed': PolicyCompletedPayloadSchema,
  'processing.complete': ProcessingCompletePayloadSchema,
  'request.finalized': RequestFinalizedPayloadSchema,
};
