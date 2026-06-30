import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import * as SYS_MSG from '@constants/system-messages';

/** Swagger for GET /catalog/skus (manual re-map search). */
export function SearchSkusDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags('Catalog'),
    ApiOperation({
      summary: 'Search the catalog by keyword',
      description:
        'Lexical (pg_trgm) search over SKU code, name, and description for the re-map drawer manual ' +
        'fallback. Org-scoped when auth is enabled. Returns an empty list for a blank query.',
    }),
    ApiQuery({ name: 'q', required: true, description: 'Search keywords', example: 'socket cap' }),
    ApiQuery({
      name: 'limit',
      required: false,
      description: 'Max results (default 10, capped at 25)',
      example: 10,
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: SYS_MSG.SKUS_RETRIEVED,
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: HttpStatus.OK },
          message: { type: 'string', example: SYS_MSG.SKUS_RETRIEVED },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                sku_id: { type: 'string', format: 'uuid' },
                sku_code: { type: 'string', example: 'SKU-065' },
                name: { type: 'string', example: 'M6 Socket Cap Screw Zinc Plated' },
                description: { type: 'string', nullable: true },
                base_price_minor: { type: 'number', example: 1800 },
                currency: { type: 'string', example: 'NGN' },
                lead_time_days: { type: 'number', nullable: true, example: 3 },
                score: { type: 'number', example: 0.42 },
              },
            },
          },
        },
      },
    }),
  );
}
