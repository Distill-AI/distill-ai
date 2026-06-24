import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PasteAttachmentDto } from '../dto/paste-attachment.dto';
import * as SYS_MSG from '@constants/system-messages';

const BASE_PATH = '/api/v1/requests/{id}/attachments/{attachmentId}/paste';
const TIMESTAMP_EXAMPLE = '2026-06-19T00:00:00.000Z';

function errorSchema(statusCode: HttpStatus, error: string, message: string) {
  return {
    example: {
      success: false,
      statusCode,
      error,
      message,
      path: BASE_PATH,
      timestamp: TIMESTAMP_EXAMPLE,
    },
  };
}

export function RequestEventsDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags('Requests'),
    ApiOperation({
      summary: 'Stream live processing trace via SSE',
      description:
        'Opens a Server-Sent Events (SSE) connection that streams live processing trace events ' +
        'for the given request. Events are emitted as each pipeline stage executes: ' +
        'parse → extract → match → score → price → policy. ' +
        'Tool invocations (extract, match) are included with retry indicators. ' +
        'No raw model reasoning or chain-of-thought is emitted. ' +
        'The stream closes when processing completes (success or failure) or on client disconnect.',
    }),
    ApiParam({
      name: 'id',
      description: 'UUID of the request to trace',
      required: true,
      type: 'string',
      format: 'uuid',
    }),
    ApiProduces('text/event-stream'),
    ApiResponse({
      status: 200,
      description:
        'SSE event stream. Each event is formatted as:\n\n' +
        '```\n' +
        'event: node.entered\ndata: {"type":"node.entered","timestamp":"...","node":"parse","status":"processing"}\n\n' +
        'event: node.exited\ndata: {"type":"node.exited","timestamp":"...","node":"parse","status":"success","duration_ms":500,"summary":"Parsed email + attachments"}\n\n' +
        'event: tool.invoked\ndata: {"type":"tool.invoked","node":"extract","tool_name":"catalog_search","status":"running","attempt":1,"result_summary":"Invoking tool"}\n\n' +
        'event: processing.complete\ndata: {"type":"processing.complete","timestamp":"...","status":"success","total_duration_ms":10000}\n\n' +
        '```',
      content: { 'text/event-stream': { schema: { type: 'string' } } },
    }),
    ApiResponse({
      status: 404,
      description: SYS_MSG.REQUEST_NOT_FOUND('{id}'),
    }),
    ApiResponse({
      status: 401,
      description: SYS_MSG.AUTH_UNAUTHORIZED,
    }),
    ApiResponse({
      status: 403,
      description: SYS_MSG.AUTH_FORBIDDEN,
    }),
  );
}

export function DownloadAttachmentDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags('Requests'),
    ApiOperation({
      summary: 'Download the original bytes of an attachment',
      description:
        'Streams the stored original file for an attachment, with its original MIME type and ' +
        'filename (via Content-Disposition). Access is scoped to the parent request: a request ' +
        'that does not exist, or that belongs to another organization, returns 404 (the same ' +
        'response as a missing attachment, so existence is not leaked across tenants).',
    }),
    ApiParam({
      name: 'id',
      description: 'UUID of the parent request',
      required: true,
      type: 'string',
      format: 'uuid',
    }),
    ApiParam({
      name: 'attachmentId',
      description: 'UUID of the attachment to download',
      required: true,
      type: 'string',
      format: 'uuid',
    }),
    ApiProduces('application/octet-stream'),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'The original attachment bytes, served with the stored MIME type.',
      content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: `${SYS_MSG.REQUEST_NOT_FOUND('{id}')} / ${SYS_MSG.ATTACHMENT_NOT_FOUND('{attachmentId}')}`,
    }),
    ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: SYS_MSG.AUTH_UNAUTHORIZED }),
    ApiResponse({ status: HttpStatus.FORBIDDEN, description: SYS_MSG.AUTH_FORBIDDEN }),
  );
}

export function PasteAttachmentDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags('Requests'),
    ApiOperation({
      summary: 'Submit pasted text for an unparsed attachment',
      description:
        'Accepts manually pasted content for an attachment that could not be parsed automatically. ' +
        'Re-checkpoints the request to the extract node and re-enqueues the pipeline. ' +
        'Returns 409 if the pipeline is already actively processing this request.',
    }),
    ApiParam({
      name: 'id',
      description: 'UUID of the parent request',
      required: true,
      type: 'string',
      format: 'uuid',
    }),
    ApiParam({
      name: 'attachmentId',
      description: 'UUID of the attachment to paste into',
      required: true,
      type: 'string',
      format: 'uuid',
    }),
    ApiBody({ type: PasteAttachmentDto }),
    ApiOkResponse({
      description: SYS_MSG.ATTACHMENT_PASTE_ACCEPTED,
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: HttpStatus.OK },
          message: { type: 'string', example: SYS_MSG.ATTACHMENT_PASTE_ACCEPTED },
          data: { type: 'object', example: null, nullable: true },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.CONFLICT,
      description: SYS_MSG.ATTACHMENT_PASTE_CONFLICT,
      schema: errorSchema(HttpStatus.CONFLICT, 'Conflict', SYS_MSG.ATTACHMENT_PASTE_CONFLICT),
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: `${SYS_MSG.REQUEST_NOT_FOUND('{id}')} / ${SYS_MSG.ATTACHMENT_NOT_FOUND('{attachmentId}')}`,
      schema: errorSchema(HttpStatus.NOT_FOUND, 'Not Found', SYS_MSG.REQUEST_NOT_FOUND('{id}')),
    }),
    ApiResponse({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      description: SYS_MSG.ATTACHMENT_PASTE_EMPTY,
      schema: errorSchema(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'Unprocessable Entity',
        SYS_MSG.ATTACHMENT_PASTE_EMPTY,
      ),
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: SYS_MSG.AUTH_UNAUTHORIZED,
      schema: errorSchema(HttpStatus.UNAUTHORIZED, 'Unauthorized', SYS_MSG.AUTH_UNAUTHORIZED),
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: SYS_MSG.AUTH_FORBIDDEN,
      schema: errorSchema(HttpStatus.FORBIDDEN, 'Forbidden', SYS_MSG.AUTH_FORBIDDEN),
    }),
  );
}
