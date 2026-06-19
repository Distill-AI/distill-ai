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
    timestamp: '2026-06-19T00:00:00.000Z',
  },
});

export function InvokeToolDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Invoke a registered tool by name',
      description:
        'Looks up the tool contract by name, validates input against its Zod schema, ' +
        'executes the tool, validates the output, and returns the result. Every call is ' +
        'persisted to the `tool_calls` table for auditability.\n\n' +
        '**Status values**\n' +
        '- `ok` – tool executed and output passed validation\n' +
        '- `validation_error` – input or output failed schema validation\n' +
        '- `error` – tool threw during execution\n' +
        '- `timeout` – tool exceeded its configured timeout (default 30 s)\n\n' +
        '**Built-in tools**\n' +
        '- `echo_tool` – returns the same string passed in (tier: free)',
    }),
    ApiBody({
      schema: {
        properties: {
          toolName: {
            type: 'string',
            example: 'echo_tool',
            description: 'Name of the registered tool (case-insensitive)',
          },
          args: {
            type: 'object',
            example: { message: 'hello' },
            description: 'Arguments for the tool, validated against the tool input schema',
          },
        },
        required: ['toolName', 'args'],
      },
    }),
    ApiOkResponse({
      description: SYS_MSG.TOOL_INVOKE_SUCCESS,
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: HttpStatus.OK },
          message: { type: 'string', example: SYS_MSG.TOOL_INVOKE_SUCCESS },
          data: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['ok', 'error', 'timeout', 'validation_error'],
                example: 'ok',
              },
              latency: { type: 'number', example: 5 },
              result: {
                type: 'object',
                example: { echoed: 'hello' },
              },
              error: { type: 'string', example: null },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Input validation failed',
      schema: errorSchema(
        HttpStatus.BAD_REQUEST,
        'Bad Request',
        SYS_MSG.TOOL_INPUT_VALIDATION_FAILED,
      ),
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Tool not found',
      schema: errorSchema(HttpStatus.NOT_FOUND, 'Not Found', SYS_MSG.TOOL_NOT_FOUND('echo_tool')),
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

export function ListToolsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'List all registered tools',
      description: 'Returns metadata (name + description) for every registered tool contract.',
    }),
    ApiOkResponse({
      description: SYS_MSG.TOOL_LIST_SUCCESS,
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: HttpStatus.OK },
          message: { type: 'string', example: SYS_MSG.TOOL_LIST_SUCCESS },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                toolName: { type: 'string', example: 'echo_tool' },
                description: { type: 'string', example: 'Simple echo tool' },
              },
            },
          },
        },
      },
    }),
  );
}
