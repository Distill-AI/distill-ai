import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiResponse } from '@nestjs/swagger';
import * as SYS_MSG from '@constants/system-messages';
import { MAX_UPLOAD_MB } from '../ingestion.constants';

const badRequestExample = (message: string) => ({
  example: {
    success: false,
    statusCode: HttpStatus.BAD_REQUEST,
    error: HttpStatus[HttpStatus.BAD_REQUEST],
    message,
    path: '/api/v1/requests',
    timestamp: '2026-06-22T00:00:00.000Z',
  },
});

/** Swagger for `POST /requests`: multipart intake (files and/or pasted text). */
export function CreateRequestDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Submit a request by uploading files or pasting text',
      description:
        'Creates a request and queues it for the parse pipeline (returns 202). Two intake modes:\n\n' +
        '**Upload**: send one or more files in the `files` part. Allowed types are PDF, CSV, and ' +
        `TXT; each file must be at most ${MAX_UPLOAD_MB} MB. The original bytes are stored and a ` +
        'request with `current_node=parse`, `status=parsing` is created.\n\n' +
        '**Paste**: omit files and send the RFQ text in `source_body`; the request is recorded ' +
        'with `channel=email`.\n\n' +
        'Provide at least one file or non-empty `source_body`. `channel` is optional and inferred ' +
        'when omitted (files -> upload, otherwise email).',
    }),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        properties: {
          files: {
            type: 'array',
            items: { type: 'string', format: 'binary' },
            description: 'PDF/CSV/TXT attachments. Required unless source_body is provided.',
          },
          channel: { type: 'string', enum: ['email', 'upload', 'form'], example: 'upload' },
          source_subject: { type: 'string', example: 'RFQ - 200x M12 bolts' },
          source_body: {
            type: 'string',
            description: 'Pasted RFQ text (paste mode). Required when no files are sent.',
          },
          sender_company: { type: 'string', example: 'Acme Industrial' },
          sender_contact: { type: 'string', example: 'Jane Doe' },
          sender_email: { type: 'string', format: 'email', example: 'jane@acme.example' },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.ACCEPTED,
      description: SYS_MSG.REQUEST_CREATED,
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: HttpStatus.ACCEPTED },
          message: { type: 'string', example: SYS_MSG.REQUEST_CREATED },
          data: {
            type: 'object',
            properties: {
              request_id: { type: 'string', format: 'uuid' },
              status: { type: 'string', example: 'parsing' },
              current_node: { type: 'string', example: 'parse' },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Unsupported file type, file too large, or no input provided',
      schema: badRequestExample(SYS_MSG.UNSUPPORTED_FILE_TYPE),
    }),
  );
}
