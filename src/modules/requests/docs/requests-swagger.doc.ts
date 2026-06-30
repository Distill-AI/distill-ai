import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiBody,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { PasteAttachmentDto } from '../dto/paste-attachment.dto';
import { DeclineRequestDto } from '../dto/decline-request.dto';
import { RequestSummaryResponseDto, RequestDetailResponseDto } from './requests-response.dto';
import * as SYS_MSG from '@constants/system-messages';

const BASE_PATH = '/api/v1/requests/{id}/attachments/{attachmentId}/paste';
const TIMESTAMP_EXAMPLE = '2026-06-19T00:00:00.000Z';

function errorSchema(
  statusCode: HttpStatus,
  error: string,
  message: string | string[],
  path?: string,
) {
  return {
    example: {
      success: false,
      statusCode,
      error,
      message,
      path: path ?? BASE_PATH,
      timestamp: TIMESTAMP_EXAMPLE,
    },
  };
}

const PAGINATION_META_SCHEMA = {
  type: 'object',
  properties: {
    total: { type: 'number' },
    page: { type: 'number' },
    limit: { type: 'number' },
    total_pages: { type: 'number' },
    has_next: { type: 'boolean' },
    has_previous: { type: 'boolean' },
  },
};

export function ListRequestsDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags('Requests'),
    ApiExtraModels(RequestSummaryResponseDto),
    ApiOperation({
      summary: 'List requests for the Inbox',
      description:
        "Returns requests for the caller's organization, newest first, for the Inbox list. " +
        'Paginated via `page` and `limit`; pagination fields are returned under `meta`.',
    }),
    ApiQuery({ name: 'page', required: false, type: 'integer', description: 'Page number (>= 1)' }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: 'integer',
      description: 'Page size (1-100, default 50)',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: HttpStatus.OK },
          message: { type: 'string', example: SYS_MSG.REQUESTS_RETRIEVED },
          data: { type: 'array', items: { $ref: getSchemaPath(RequestSummaryResponseDto) } },
          meta: PAGINATION_META_SCHEMA,
        },
      },
    }),
    ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: SYS_MSG.AUTH_UNAUTHORIZED }),
    ApiResponse({ status: HttpStatus.FORBIDDEN, description: SYS_MSG.AUTH_FORBIDDEN }),
  );
}

export function GetRequestDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags('Requests'),
    ApiExtraModels(RequestDetailResponseDto),
    ApiOperation({
      summary: 'Get a single request with its attachments',
      description:
        'Returns the full detail for one request plus its attachment metadata, for the Review screen. ' +
        'A missing or cross-org request returns 404 so existence is not leaked across tenants. ' +
        'Internal attachment fields (storage location, parsed/raw text) are not exposed.',
    }),
    ApiParam({
      name: 'id',
      description: 'UUID of the request',
      required: true,
      type: 'string',
      format: 'uuid',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: HttpStatus.OK },
          message: { type: 'string', example: SYS_MSG.REQUEST_RETRIEVED },
          data: { $ref: getSchemaPath(RequestDetailResponseDto) },
        },
      },
    }),
    ApiResponse({ status: HttpStatus.NOT_FOUND, description: SYS_MSG.REQUEST_NOT_FOUND('{id}') }),
    ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: SYS_MSG.AUTH_UNAUTHORIZED }),
    ApiResponse({ status: HttpStatus.FORBIDDEN, description: SYS_MSG.AUTH_FORBIDDEN }),
  );
}

export function RequestEventsDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags('Requests'),
    ApiOperation({
      summary: 'Stream live processing trace via SSE',
      description:
        'Opens a Server-Sent Events (SSE) connection that streams live processing trace events ' +
        'for the given request. Events are emitted as each pipeline stage executes: ' +
        'parse -> extract -> match -> score -> price -> policy. ' +
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
        'SSE event stream of node.entered / node.exited / tool.invoked / processing.complete events.',
      content: { 'text/event-stream': { schema: { type: 'string' } } },
    }),
    ApiResponse({ status: 404, description: SYS_MSG.REQUEST_NOT_FOUND('{id}') }),
    ApiResponse({ status: 401, description: SYS_MSG.AUTH_UNAUTHORIZED }),
    ApiResponse({ status: 403, description: SYS_MSG.AUTH_FORBIDDEN }),
  );
}

export function RequestResumeDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags('Requests'),
    ApiOperation({
      summary: 'Manually resume a pipeline request from its current node',
      description:
        'Resumes pipeline processing for a request from its current checkpoint node. ' +
        'Emits a `request.resumed` event with `reason=manual`. ' +
        'Responds within 1 second for healthy requests.',
    }),
    ApiParam({
      name: 'id',
      description: 'UUID of the request to resume',
      required: true,
      type: 'string',
      format: 'uuid',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      schema: {
        properties: {
          statusCode: { type: 'number', example: HttpStatus.OK },
          message: { type: 'string', example: SYS_MSG.RESUME_SUCCESS },
          data: {
            type: 'object',
            properties: {
              request_id: { type: 'string', format: 'uuid' },
              resumed: { type: 'boolean', example: true },
              resume_reason: { type: 'string', example: 'manual' },
              current_node: { type: 'string', example: 'extract' },
            },
          },
        },
      },
    }),
    ApiResponse({ status: HttpStatus.NOT_FOUND, description: SYS_MSG.REQUEST_NOT_FOUND('{id}') }),
    ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: SYS_MSG.AUTH_UNAUTHORIZED }),
    ApiResponse({ status: HttpStatus.FORBIDDEN, description: SYS_MSG.AUTH_FORBIDDEN }),
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
      schema: errorSchema(
        HttpStatus.NOT_FOUND,
        'Not Found',
        SYS_MSG.ATTACHMENT_NOT_FOUND('{attachmentId}'),
      ),
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: SYS_MSG.ATTACHMENT_PASTE_EMPTY,
      schema: errorSchema(HttpStatus.BAD_REQUEST, 'Bad Request', [SYS_MSG.ATTACHMENT_PASTE_EMPTY]),
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

const DECLINE_PATH = '/api/v1/requests/{id}/decline';

export function RequestDeclineDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags('Requests'),
    ApiOperation({
      summary: 'Decline a request with a reason',
      description:
        'Sets the request status to declined and records the decline reason in the audit trail ' +
        'under the `request.declined` event. Declining an already-declined request is idempotent ' +
        'and does not write a second audit event. The reason is required and must not be empty.',
    }),
    ApiParam({
      name: 'id',
      description: 'UUID of the request to decline',
      required: true,
      type: 'string',
      format: 'uuid',
    }),
    ApiBody({ type: DeclineRequestDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: SYS_MSG.REQUEST_DECLINED,
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: HttpStatus.OK },
          message: { type: 'string', example: SYS_MSG.REQUEST_DECLINED },
          data: {
            type: 'object',
            properties: {
              request_id: { type: 'string', format: 'uuid' },
              status: { type: 'string', example: 'declined' },
              reason: { type: 'string', example: 'Not a relevant request' },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: SYS_MSG.REQUEST_NOT_FOUND('{id}'),
      schema: errorSchema(
        HttpStatus.NOT_FOUND,
        'Not Found',
        SYS_MSG.REQUEST_NOT_FOUND('{id}'),
        DECLINE_PATH,
      ),
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: SYS_MSG.DECLINE_REASON_REQUIRED,
      schema: errorSchema(
        HttpStatus.BAD_REQUEST,
        'Bad Request',
        [SYS_MSG.DECLINE_REASON_REQUIRED],
        DECLINE_PATH,
      ),
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: SYS_MSG.AUTH_UNAUTHORIZED,
      schema: errorSchema(
        HttpStatus.UNAUTHORIZED,
        'Unauthorized',
        SYS_MSG.AUTH_UNAUTHORIZED,
        DECLINE_PATH,
      ),
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: SYS_MSG.AUTH_FORBIDDEN,
      schema: errorSchema(HttpStatus.FORBIDDEN, 'Forbidden', SYS_MSG.AUTH_FORBIDDEN, DECLINE_PATH),
    }),
  );
}
