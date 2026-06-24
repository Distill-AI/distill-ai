import { z } from 'zod';

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
  reason: z.enum(Object.values(StageErrorReason) as [string, ...string[]]),
  escalated_to_human: z.literal(true),
  occurred_at: z.string().datetime(),
});

export type StageErrorPayload = z.infer<typeof StageErrorPayloadSchema>;
