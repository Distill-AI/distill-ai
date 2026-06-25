import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiBody, ApiOkResponse, ApiResponse } from '@nestjs/swagger';
import * as SYS_MSG from '@constants/system-messages';

const errorSchema = (statusCode: HttpStatus, error: string, message: string) => ({
  example: {
    success: false,
    statusCode,
    error,
    message,
    path: '/api/v1/pricing/{endpoint}',
    timestamp: '2026-06-25T00:00:00.000Z',
  },
});

export function GetPricingRulesDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get current pricing rules',
      description:
        'Returns the currently active pricing rules loaded from the pricing-rules.json config file. ' +
        'These rules include margin floor, max discount limits, and quantity break tiers. ' +
        'If the config file is malformed or unreadable, the last known-good rules are returned ' +
        'instead (fallback behaviour).',
    }),
    ApiOkResponse({
      description: SYS_MSG.PRICING_RULES_RETRIEVED,
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: HttpStatus.OK },
          message: { type: 'string', example: SYS_MSG.PRICING_RULES_RETRIEVED },
          data: {
            type: 'object',
            properties: {
              marginFloor: {
                type: 'object',
                properties: {
                  default: { type: 'number', example: 15 },
                  byOrg: { type: 'object', example: {} },
                },
              },
              maxDiscount: {
                type: 'object',
                properties: {
                  default: { type: 'number', example: 25 },
                  byOrg: { type: 'object', example: {} },
                },
              },
              quantityBreaks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    minQty: { type: 'number', example: 1 },
                    maxQty: { type: 'number', example: 10 },
                    discountPercent: { type: 'number', example: 0 },
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

export function ReloadPricingRulesDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Force-reload pricing rules from config file',
      description:
        'Triggers an immediate re-read of the pricing-rules.json config file. ' +
        'If parsing or validation fails, the last known-good rules remain in effect ' +
        'and an error response is returned. Useful after editing the config file to ' +
        'verify the new rules are valid before they take effect on the next quote evaluation.',
    }),
    ApiBody({
      schema: {
        properties: {
          configPath: {
            type: 'string',
            example: './config/pricing-rules.json',
            description: 'Optional override path to the pricing rules config file',
          },
        },
      },
    }),
    ApiOkResponse({
      description: SYS_MSG.PRICING_RULES_RELOADED,
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: HttpStatus.OK },
          message: { type: 'string', example: SYS_MSG.PRICING_RULES_RELOADED },
          data: {
            type: 'object',
            properties: {
              marginFloor: { type: 'object' },
              maxDiscount: { type: 'object' },
              quantityBreaks: {
                type: 'array',
                items: { type: 'object' },
              },
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
        'Pricing rules configuration is invalid: ...',
      ),
    }),
  );
}

export function EvaluatePriceDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Evaluate pricing rules against a quote',
      description:
        'Applies the currently loaded pricing rules (margin floor, max discount, quantity breaks) ' +
        'to the given quote parameters. Returns any breaches and the effective discount rate. ' +
        'Each evaluation uses a single consistent snapshot of the rules — a mid-evaluation config ' +
        'change never retroactively affects an in-flight evaluation.',
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
          quantity: { type: 'number', example: 75 },
          marginPercent: { type: 'number', example: 12 },
          discountPercent: { type: 'number', example: 8 },
        },
        required: ['orgId', 'total', 'quantity', 'marginPercent', 'discountPercent'],
      },
    }),
    ApiOkResponse({
      description: SYS_MSG.PRICING_EVALUATED,
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: HttpStatus.OK },
          message: { type: 'string', example: SYS_MSG.PRICING_EVALUATED },
          data: {
            type: 'object',
            properties: {
              approved: { type: 'boolean', example: false },
              effectiveDiscount: { type: 'number', example: 10 },
              appliedRules: {
                type: 'object',
                properties: {
                  marginFloor: { type: 'number', example: 15 },
                  maxDiscount: { type: 'number', example: 25 },
                  quantityBreakApplied: { type: 'number', example: 10 },
                },
              },
              breaches: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    rule: { type: 'string', example: 'margin_floor' },
                    severity: { type: 'string', example: 'error' },
                    message: { type: 'string' },
                    current: { type: 'number', example: 12 },
                    limit: { type: 'number', example: 15 },
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
