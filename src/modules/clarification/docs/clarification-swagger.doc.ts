import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiResponse,
} from '@nestjs/swagger';
import * as SYS_MSG from '@constants/system-messages';

const errorSchema = (statusCode: HttpStatus, error: string, message: string) => ({
  example: {
    success: false,
    statusCode,
    error,
    message,
    path: '/api/v1/{endpoint}',
    timestamp: '2026-06-29T00:00:00.000Z',
  },
});

export function GenerateDraftDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Generate a clarification draft for a request',
      description:
        'Creates or updates a clarification row for the given request. ' +
        'The draft subject and body are generated via an LLM tool call based on the detected gaps. ' +
        'The draft is saved with sent_at null, ensuring it never auto-sends. ' +
        'Returns the clarification record with the AI-generated draft content.',
    }),
    ApiParam({ name: 'requestId', type: 'string', format: 'uuid', description: 'Request UUID' }),
    ApiBody({
      schema: {
        properties: {
          gaps: {
            type: 'array',
            items: { type: 'string' },
            example: ['Missing delivery date', 'No contact name provided'],
            description: 'List of detected information gaps',
          },
        },
        required: ['gaps'],
      },
    }),
    ApiCreatedResponse({
      description: SYS_MSG.CLARIFICATION_DRAFT_GENERATED,
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: HttpStatus.CREATED },
          message: { type: 'string', example: SYS_MSG.CLARIFICATION_DRAFT_GENERATED },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              request_id: { type: 'string', format: 'uuid' },
              gaps: { type: 'array', items: { type: 'string' } },
              draft_subject: { type: 'string', nullable: true },
              draft_body: { type: 'string', nullable: true },
              sent_at: { type: 'string', nullable: true, example: null },
              sent_by: { type: 'string', nullable: true, example: null },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Request not found',
      schema: errorSchema(HttpStatus.NOT_FOUND, 'Not Found', SYS_MSG.REQUEST_NOT_FOUND('')),
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'No gaps provided',
      schema: errorSchema(HttpStatus.BAD_REQUEST, 'Bad Request', SYS_MSG.CLARIFICATION_NO_GAPS),
    }),
  );
}

export function GetClarificationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get clarification for a request',
      description:
        'Returns the clarification record associated with the given request, if one exists. ' +
        'Includes the current draft content and sent status.',
    }),
    ApiParam({ name: 'requestId', type: 'string', format: 'uuid', description: 'Request UUID' }),
    ApiOkResponse({
      description: 'Clarification retrieved',
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: HttpStatus.OK },
          message: { type: 'string', example: 'Clarification retrieved' },
          data: { type: 'object' },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Clarification not found',
      schema: errorSchema(HttpStatus.NOT_FOUND, 'Not Found', 'Clarification not found'),
    }),
  );
}

export function UpdateDraftDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update the clarification draft',
      description:
        'Allows a reviewer to edit the draft subject and/or body before sending. ' +
        'The updated version is what gets sent when the Send action is performed. ' +
        'Partial updates are supported — omit fields you do not want to change.',
    }),
    ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Clarification UUID' }),
    ApiBody({
      schema: {
        properties: {
          draft_subject: { type: 'string', example: 'Updated: Request for additional details' },
          draft_body: { type: 'string', example: 'Updated email body...' },
        },
      },
    }),
    ApiOkResponse({
      description: SYS_MSG.CLARIFICATION_DRAFT_UPDATED,
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: HttpStatus.OK },
          message: { type: 'string', example: SYS_MSG.CLARIFICATION_DRAFT_UPDATED },
          data: { type: 'object' },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Clarification not found',
      schema: errorSchema(HttpStatus.NOT_FOUND, 'Not Found', 'Clarification not found'),
    }),
  );
}

export function SendClarificationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Send the clarification (human gate)',
      description:
        'Marks the clarification as sent by setting sent_at and sent_by. ' +
        'This is the ONLY code path that sets sent_at — enforced by the implementation and verified by test. ' +
        'Calling Send twice is idempotent: once sent_at is set, a repeat call returns the same record unchanged. ' +
        'This is the human-gate trust boundary: no AI-drafted message reaches a customer without explicit reviewer approval.',
    }),
    ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Clarification UUID' }),
    ApiBody({
      schema: {
        properties: {
          sent_by: { type: 'string', format: 'uuid', description: 'User ID of the reviewer' },
        },
        required: ['sent_by'],
      },
    }),
    ApiOkResponse({
      description: SYS_MSG.CLARIFICATION_SENT,
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: HttpStatus.OK },
          message: { type: 'string', example: SYS_MSG.CLARIFICATION_SENT },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              sent_at: { type: 'string', format: 'date-time' },
              sent_by: { type: 'string', format: 'uuid' },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Clarification not found',
      schema: errorSchema(HttpStatus.NOT_FOUND, 'Not Found', 'Clarification not found'),
    }),
  );
}
