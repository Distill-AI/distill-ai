import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { CandidateResponseDto } from './line-items-response.dto';
import * as SYS_MSG from '@constants/system-messages';

const TIMESTAMP_EXAMPLE = '2026-06-25T00:00:00.000Z';

function errorSchema(statusCode: HttpStatus, error: string, message: string) {
  return {
    example: {
      success: false,
      statusCode,
      error,
      message,
      path: '/api/v1/line-items/{lineId}/candidates',
      timestamp: TIMESTAMP_EXAMPLE,
    },
  };
}

export function GetCandidatesDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags('Line Items'),
    ApiExtraModels(CandidateResponseDto),
    ApiOperation({
      summary: 'Get ranked alternative candidates for a line item',
      description:
        'Returns the ranked catalog candidates the matcher scored for a line item, ' +
        'each with confidence and base price. Useful for the estimator re-map drawer. ' +
        'Returns an empty list when no candidates were stored. ' +
        'A missing or cross-org lineId returns 404 so existence is not leaked across tenants.',
    }),
    ApiParam({
      name: 'lineId',
      description: 'UUID of the line item',
      format: 'uuid',
      required: true,
    }),
    ApiResponse({
      status: HttpStatus.OK,
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: HttpStatus.OK },
          message: { type: 'string', example: SYS_MSG.CANDIDATES_RETRIEVED },
          data: { type: 'array', items: { $ref: getSchemaPath(CandidateResponseDto) } },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'lineId is not a valid UUID v4',
      schema: errorSchema(
        HttpStatus.BAD_REQUEST,
        'Bad Request',
        'Validation failed (uuid v 4 is expected)',
      ),
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: SYS_MSG.LINE_ITEM_NOT_FOUND('{lineId}'),
      schema: errorSchema(
        HttpStatus.NOT_FOUND,
        'Not Found',
        SYS_MSG.LINE_ITEM_NOT_FOUND('{lineId}'),
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
