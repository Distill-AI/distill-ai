import { applyDecorators, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import * as SYS_MSG from '@constants/system-messages';
import { AskCopilotDto } from '../dto/ask-copilot.dto';
import { AskCopilotResponseDto, CopilotExplanationResponseDto } from './copilot-response.dto';

export function CopilotExplanationDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags('Copilot'),
    ApiExtraModels(CopilotExplanationResponseDto),
    ApiOperation({
      summary: 'Get the advisory routing explanation for a request',
      description:
        'Returns a plain-English explanation of why a needs_review quote requires manual review, ' +
        'sourced from the explain_routing tool (or its template fallback, flagged via degraded: ' +
        'true). Requests that are not needs_review (auto-eligible, or not yet scored) return an ' +
        'empty explanation without calling the tool. ' +
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

export function AskCopilotDocs(): MethodDecorator {
  return applyDecorators(
    HttpCode(HttpStatus.OK),
    ApiTags('Copilot'),
    ApiExtraModels(AskCopilotResponseDto),
    ApiOperation({
      summary: 'Ask the agentic copilot a free-text question about a request',
      description:
        'Runs a bounded ReAct loop (reason, call search_catalog or explain_routing, observe, repeat) ' +
        'over the request, capped at AGENTIC_COPILOT_MAX_STEPS. Disabled by default via ' +
        'AGENTIC_COPILOT_ENABLED (404 when off). Returns a canned fixture in DEMO_MODE with no ' +
        'outbound LLM call. A missing or cross-org request returns 404 so existence is not leaked ' +
        'across tenants.',
    }),
    ApiParam({
      name: 'id',
      description: 'UUID of the request',
      required: true,
      type: 'string',
      format: 'uuid',
    }),
    ApiBody({ type: AskCopilotDto }),
    ApiResponse({
      status: HttpStatus.OK,
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: HttpStatus.OK },
          message: { type: 'string', example: SYS_MSG.AGENTIC_COPILOT_ANSWERED },
          data: { $ref: getSchemaPath(AskCopilotResponseDto) },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: `${SYS_MSG.REQUEST_NOT_FOUND('{id}')} / ${SYS_MSG.AGENTIC_COPILOT_DISABLED}`,
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: `${SYS_MSG.AGENTIC_COPILOT_QUESTION_REQUIRED} / ${SYS_MSG.AGENTIC_COPILOT_QUESTION_TOO_LONG}`,
    }),
    ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: SYS_MSG.AUTH_UNAUTHORIZED }),
    ApiResponse({ status: HttpStatus.FORBIDDEN, description: SYS_MSG.AUTH_FORBIDDEN }),
  );
}
