import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import * as SYS_MSG from '@constants/system-messages';
import { ApproveQuoteResponseDto } from './quotes-response.dto';

const errorSchema = (statusCode: HttpStatus, error: string, message: string) => ({
  example: {
    success: false,
    statusCode,
    error,
    message,
    path: '/api/v1/requests/{requestId}/quote',
    timestamp: '2026-06-29T00:00:00.000Z',
  },
});

export function ApproveAndGenerateQuoteDocs() {
  return applyDecorators(
    ApiExtraModels(ApproveQuoteResponseDto),
    ApiOperation({
      summary: 'Approve a priced quote and generate its PDF',
      description:
        "Atomically claims the request's DRAFT quote, invokes render_quote_pdf to template and " +
        'store its PDF, best-effort drafts a follow-up email via draft_quote_email, and emits ' +
        'quote.approved/quote.ready. Idempotent: an already-READY quote returns its existing ' +
        'payload without regenerating the PDF.',
    }),
    ApiParam({ name: 'requestId', type: 'string', format: 'uuid', description: 'Request UUID' }),
    ApiResponse({
      status: HttpStatus.OK,
      description: SYS_MSG.QUOTE_APPROVED_SUCCESS,
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: HttpStatus.OK },
          message: { type: 'string', example: SYS_MSG.QUOTE_APPROVED_SUCCESS },
          data: { $ref: getSchemaPath(ApproveQuoteResponseDto) },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: SYS_MSG.REQUEST_NOT_FOUND('{requestId}'),
      schema: errorSchema(
        HttpStatus.NOT_FOUND,
        'Not Found',
        SYS_MSG.REQUEST_NOT_FOUND('{requestId}'),
      ),
    }),
    ApiResponse({
      status: HttpStatus.CONFLICT,
      description:
        'Request status is not approvable, or the quote is not priced or not in a valid state to approve',
      schema: errorSchema(
        HttpStatus.CONFLICT,
        'Conflict',
        SYS_MSG.QUOTE_REQUEST_NOT_APPROVABLE('{status}'),
      ),
    }),
    ApiResponse({
      status: HttpStatus.FAILED_DEPENDENCY,
      description: SYS_MSG.QUOTE_PDF_GENERATION_FAILED,
      schema: errorSchema(
        HttpStatus.FAILED_DEPENDENCY,
        'Failed Dependency',
        SYS_MSG.QUOTE_PDF_GENERATION_FAILED,
      ),
    }),
  );
}

export function DownloadQuotePdfDocs() {
  return applyDecorators(
    ApiOperation({
      summary: "Download the request's generated quote PDF",
      description:
        'Streams the stored quote PDF bytes. Access is scoped to the parent request: a request ' +
        'that does not exist, that belongs to another organization, or whose quote has no ' +
        'generated PDF yet, returns 404.',
    }),
    ApiParam({ name: 'requestId', type: 'string', format: 'uuid', description: 'Request UUID' }),
    ApiProduces('application/pdf'),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'The generated quote PDF bytes.',
      content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: SYS_MSG.QUOTE_PDF_NOT_READY('{requestId}'),
      schema: errorSchema(
        HttpStatus.NOT_FOUND,
        'Not Found',
        SYS_MSG.QUOTE_PDF_NOT_READY('{requestId}'),
      ),
    }),
  );
}
