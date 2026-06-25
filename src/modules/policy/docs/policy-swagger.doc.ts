import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiBody, ApiOkResponse, ApiResponse } from '@nestjs/swagger';
import * as SYS_MSG from '@constants/system-messages';

const errorSchema = (statusCode: HttpStatus, error: string, message: string) => ({
  example: {
    success: false,
    statusCode,
    error,
    message,
    path: '/api/v1/policy/{endpoint}',
    timestamp: '2026-06-25T00:00:00.000Z',
  },
});

export function GetPolicyRulesDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get current policy rules',
      description:
        'Returns the currently active policy rules loaded from the policy-rules.json config file. ' +
        'These rules include auto-approve thresholds, max line items, restricted categories, ' +
        'and a list of customizable policy rules. If the config file is malformed or unreadable, ' +
        'the last known-good rules are returned instead (fallback behaviour).',
    }),
    ApiOkResponse({
      description: SYS_MSG.POLICY_RULES_RETRIEVED,
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: HttpStatus.OK },
          message: { type: 'string', example: SYS_MSG.POLICY_RULES_RETRIEVED },
          data: {
            type: 'object',
            properties: {
              autoApproveThreshold: { type: 'number', example: 5000 },
              maxLineItems: { type: 'number', example: 100 },
              restrictedCategories: {
                type: 'array',
                items: { type: 'string' },
                example: [],
              },
              rules: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', example: 'auto_approve_small_orders' },
                    condition: { type: 'string', example: 'total <= autoApproveThreshold' },
                    action: { type: 'string', example: 'approve' },
                    priority: { type: 'number', example: 10 },
                    active: { type: 'boolean', example: true },
                  },
                },
              },
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

export function ReloadPolicyRulesDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Force-reload policy rules from config file',
      description:
        'Triggers an immediate re-read of the policy-rules.json config file. ' +
        'If parsing or validation fails, the last known-good rules remain in effect ' +
        'and an error response is returned. Useful after editing the config file to ' +
        'verify the new rules are valid before they take effect on the next policy evaluation.',
    }),
    ApiBody({
      schema: {
        properties: {
          configPath: {
            type: 'string',
            example: './config/policy-rules.json',
            description: 'Optional override path to the policy rules config file',
          },
        },
      },
    }),
    ApiOkResponse({
      description: SYS_MSG.POLICY_RULES_RELOADED,
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: HttpStatus.OK },
          message: { type: 'string', example: SYS_MSG.POLICY_RULES_RELOADED },
          data: {
            type: 'object',
            properties: {
              autoApproveThreshold: { type: 'number' },
              maxLineItems: { type: 'number' },
              restrictedCategories: { type: 'array', items: { type: 'string' } },
              rules: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      description: 'Config validation failed',
      schema: errorSchema(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'Unprocessable Entity',
        'Policy rules configuration is invalid: ...',
      ),
    }),
  );
}

export function EvaluatePolicyDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Evaluate policy rules against a quote',
      description:
        'Applies the currently loaded policy rules (max line items, restricted categories, ' +
        'auto-approve threshold, and custom rules) to the given quote parameters. ' +
        'Returns any violations and whether the quote qualifies for auto-approval. ' +
        'Each evaluation uses a single consistent snapshot of the rules.',
    }),
    ApiBody({
      schema: {
        properties: {
          orgId: {
            type: 'string',
            format: 'uuid',
            example: '550e8400-e29b-41d4-a716-446655440000',
          },
          total: { type: 'number', example: 15000 },
          lineItems: { type: 'number', example: 5 },
          categories: {
            type: 'array',
            items: { type: 'string' },
            example: ['electronics'],
          },
        },
        required: ['orgId', 'total', 'lineItems'],
      },
    }),
    ApiOkResponse({
      description: SYS_MSG.POLICY_EVALUATED,
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: HttpStatus.OK },
          message: { type: 'string', example: SYS_MSG.POLICY_EVALUATED },
          data: {
            type: 'object',
            properties: {
              approved: { type: 'boolean', example: true },
              autoApprovable: { type: 'boolean', example: false },
              triggeredRules: {
                type: 'array',
                items: { type: 'string' },
                example: ['auto_approve_small_orders'],
              },
              violations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    rule: { type: 'string', example: 'max_line_items' },
                    severity: { type: 'string', example: 'error' },
                    message: { type: 'string' },
                    current: { type: 'number', example: 150 },
                    limit: { type: 'number', example: 100 },
                  },
                },
              },
            },
          },
        },
      },
    }),
  );
}
