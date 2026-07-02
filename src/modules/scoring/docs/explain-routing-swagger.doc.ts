import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiBody, ApiOkResponse, ApiResponse } from '@nestjs/swagger';
import * as SYS_MSG from '@constants/system-messages';

const errorSchema = (statusCode: HttpStatus, error: string, message: string) => ({
  example: {
    success: false,
    statusCode,
    error,
    message,
    path: '/api/v1/tools/invoke',
    timestamp: '2026-07-02T00:00:00.000Z',
  },
});

export function ExplainRoutingDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Explain routing decision for a quote',
      description:
        "Read-only advisory tool. Accepts a quote's routing decision, confidence score, routing reasons, " +
        'and optional policy flags, then returns a short plain-English explanation paragraph. ' +
        'The tool never modifies any state and writes only its tool_calls audit log.\n\n' +
        '**When to use**\n' +
        'Call this after the score node has set routing_reasons on a request, when an estimator needs ' +
        'to understand why a quote was flagged for review or marked auto-eligible.\n\n' +
        '**Fallback behavior**\n' +
        'If the LLM provider is unreachable, a template-based explanation is returned with `degraded: true`. ' +
        'The core review flow is never affected because nothing depends on this tool.',
    }),
    ApiBody({
      schema: {
        properties: {
          toolName: {
            type: 'string',
            example: 'explain_routing',
            description: 'Must be "explain_routing"',
          },
          args: {
            type: 'object',
            properties: {
              routing: {
                type: 'string',
                enum: ['auto_eligible', 'needs_review'],
                example: 'needs_review',
                description: 'Final routing decision from the score node',
              },
              overallConfidence: {
                type: 'number',
                minimum: 0,
                maximum: 1,
                example: 0.72,
                description: 'Aggregate confidence score (0–1)',
              },
              routingReasons: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', example: 'low_line_confidence' },
                    message: {
                      type: 'string',
                      example: 'Line confidence 0.72 below auto threshold 0.95',
                    },
                    source: {
                      type: 'string',
                      enum: ['extraction', 'confidence', 'policy'],
                      example: 'confidence',
                    },
                  },
                },
                description: 'Reasons that drove the routing decision',
              },
              policyFlags: {
                type: 'array',
                items: { type: 'string' },
                example: ['margin_floor_breach'],
                description: 'Optional policy breach flags on line items',
              },
            },
            required: ['routing', 'overallConfidence', 'routingReasons'],
          },
        },
        required: ['toolName', 'args'],
      },
    }),
    ApiOkResponse({
      description: SYS_MSG.EXPLAIN_ROUTING_SUCCESS,
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: HttpStatus.OK },
          message: { type: 'string', example: SYS_MSG.TOOL_INVOKE_SUCCESS },
          data: {
            type: 'object',
            properties: {
              status: { type: 'string', example: 'ok' },
              latency: { type: 'number', example: 450 },
              result: {
                type: 'object',
                properties: {
                  explanation: {
                    type: 'string',
                    example:
                      'This quote requires manual review because line item match confidence (72%) is below the auto-eligibility threshold of 95%. Additionally, a margin floor breach was detected on one or more line items.',
                  },
                  degraded: {
                    type: 'boolean',
                    example: false,
                    description:
                      'True when the LLM was unavailable and a template fallback was used',
                  },
                },
              },
              error: { type: 'string', example: null },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      description: 'Unexpected server error',
      schema: errorSchema(
        HttpStatus.INTERNAL_SERVER_ERROR,
        SYS_MSG.HTTP_INTERNAL_SERVER_ERROR_NAME,
        SYS_MSG.HTTP_INTERNAL_SERVER_ERROR,
      ),
    }),
  );
}
