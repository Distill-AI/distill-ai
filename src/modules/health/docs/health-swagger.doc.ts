import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import * as SYS_MSG from '@constants/system-messages';

export function HealthCheckDocs() {
  return applyDecorators(
    ApiTags('Health'),
    ApiOperation({ summary: 'Check health of core infrastructure (database, Redis)' }),
    ApiResponse({
      status: HttpStatus.OK,
      description: SYS_MSG.HEALTH_OK,
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: HttpStatus.OK },
          message: { type: 'string', example: SYS_MSG.HEALTH_OK },
          data: {
            type: 'object',
            properties: {
              status: { type: 'string', example: 'ok', enum: ['ok', 'degraded'] },
              checks: {
                type: 'object',
                properties: {
                  database: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'up' },
                      responseTimeMs: { type: 'number', example: 2 },
                    },
                  },
                  redis: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'up' },
                      responseTimeMs: { type: 'number', example: 1 },
                    },
                  },
                },
              },
              timestamp: { type: 'string', example: new Date().toISOString() },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.SERVICE_UNAVAILABLE,
      description: SYS_MSG.HEALTH_DEGRADED,
      schema: {
        properties: {
          success: { type: 'boolean', example: false },
          statusCode: { type: 'number', example: HttpStatus.SERVICE_UNAVAILABLE },
          error: { type: 'string', example: 'Service Unavailable' },
          message: { type: 'string', example: SYS_MSG.HEALTH_DEGRADED },
          details: {
            type: 'object',
            properties: {
              checks: {
                type: 'object',
                properties: {
                  database: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'down' },
                      error: { type: 'string' },
                    },
                  },
                  redis: {
                    type: 'object',
                    properties: { status: { type: 'string', example: 'up' } },
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
