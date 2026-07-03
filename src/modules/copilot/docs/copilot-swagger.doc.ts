import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import * as SYS_MSG from '@constants/system-messages';
import { CopilotExplanationResponseDto } from './copilot-response.dto';

export function CopilotExplanationDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags('Copilot'),
    ApiExtraModels(CopilotExplanationResponseDto),
    ApiOperation({
      summary: 'Get the advisory routing explanation for a request',
      description:
        'Returns a plain-English explanation of why a quote was routed to auto-eligible or ' +
        'needs-review, sourced from the explain_routing tool (or its template fallback, flagged ' +
        'via degraded: true). Returns an empty explanation for requests that are not needs_review. ' +
        'A missing or cross-org request returns 404 so existence is not leaked across tenants.',
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
          message: { type: 'string', example: SYS_MSG.COPILOT_EXPLANATION_RETRIEVED },
          data: { $ref: getSchemaPath(CopilotExplanationResponseDto) },
        },
      },
    }),
    ApiResponse({ status: HttpStatus.NOT_FOUND, description: SYS_MSG.REQUEST_NOT_FOUND('{id}') }),
    ApiResponse({
      status: HttpStatus.FAILED_DEPENDENCY,
      description: SYS_MSG.COPILOT_EXPLANATION_GENERATION_FAILED,
    }),
    ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: SYS_MSG.AUTH_UNAUTHORIZED }),
    ApiResponse({ status: HttpStatus.FORBIDDEN, description: SYS_MSG.AUTH_FORBIDDEN }),
  );
}
