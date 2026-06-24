import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import * as SYS_MSG from '@constants/system-messages';

export function ListRequestsDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags('Requests'),
    ApiOperation({
      summary: 'List requests for the Inbox',
      description:
        "Returns requests for the caller's organization, newest first, for the Inbox list. " +
        'Each row carries the fields the Inbox renders: company, contact, subject, type, ' +
        'confidence, status and created_at. Results are paginated via `page` and `limit`.',
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
      description:
        'Requests retrieved.\n\n' +
        '```json\n' +
        '{\n' +
        '  "success": true,\n' +
        '  "statusCode": 200,\n' +
        '  "message": "Requests retrieved successfully",\n' +
        '  "data": [\n' +
        '    {\n' +
        '      "id": "uuid",\n' +
        '      "sender_company": "Apex Fabrication",\n' +
        '      "sender_contact": "Dana Reyes",\n' +
        '      "source_subject": "RFQ: 200x steel brackets",\n' +
        '      "request_type": "catalog_rfq",\n' +
        '      "overall_confidence": 0.96,\n' +
        '      "status": "needs_review",\n' +
        '      "created_at": "2026-06-24T10:00:00.000Z"\n' +
        '    }\n' +
        '  ],\n' +
        '  "meta": { "total": 1, "limit": 50, "page": 1 }\n' +
        '}\n' +
        '```',
    }),
    ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: SYS_MSG.AUTH_UNAUTHORIZED }),
    ApiResponse({ status: HttpStatus.FORBIDDEN, description: SYS_MSG.AUTH_FORBIDDEN }),
  );
}

export function GetRequestDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags('Requests'),
    ApiOperation({
      summary: 'Get a single request with its attachments',
      description:
        'Returns the full detail for one request (sender, body, status, confidence) plus the ' +
        'metadata of its attachments, for the Review screen. A request that does not exist, or ' +
        'belongs to another organization, returns 404 so existence is not leaked across tenants. ' +
        'Internal attachment fields (storage location, parsed text) are not exposed.',
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
      description:
        'Request retrieved.\n\n' +
        '```json\n' +
        '{\n' +
        '  "success": true,\n' +
        '  "statusCode": 200,\n' +
        '  "message": "Request retrieved successfully",\n' +
        '  "data": {\n' +
        '    "id": "uuid",\n' +
        '    "sender_company": "Apex Fabrication",\n' +
        '    "sender_contact": "Dana Reyes",\n' +
        '    "sender_email": "dana@apex.example",\n' +
        '    "source_subject": "RFQ: 200x steel brackets",\n' +
        '    "source_body": "Hi, please quote...",\n' +
        '    "request_type": "catalog_rfq",\n' +
        '    "overall_confidence": 0.96,\n' +
        '    "status": "needs_review",\n' +
        '    "current_node": "extract",\n' +
        '    "created_at": "2026-06-24T10:00:00.000Z",\n' +
        '    "attachments": [\n' +
        '      {\n' +
        '        "id": "uuid",\n' +
        '        "filename": "rfq_apex.pdf",\n' +
        '        "mime_type": "application/pdf",\n' +
        '        "size_bytes": 1258291,\n' +
        '        "created_at": "2026-06-24T10:00:00.000Z"\n' +
        '      }\n' +
        '    ]\n' +
        '  }\n' +
        '}\n' +
        '```',
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
      description:
        'Request resumed successfully.\n\n' +
        '```json\n' +
        '{\n' +
        '  "statusCode": 200,\n' +
        '  "message": "Request resumed successfully",\n' +
        '  "data": {\n' +
        '    "request_id": "uuid",\n' +
        '    "resumed": true,\n' +
        '    "resume_reason": "manual",\n' +
        '    "current_node": "extract"\n' +
        '  }\n' +
        '}\n' +
        '```',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: SYS_MSG.REQUEST_NOT_FOUND('{id}'),
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: SYS_MSG.AUTH_UNAUTHORIZED,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
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
