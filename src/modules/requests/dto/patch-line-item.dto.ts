import { IsBoolean, IsInt, IsNumber, IsOptional, Matches, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Lenient UUID shape (8-4-4-4-12 hex, any version) - matches the ids Postgres stores and that the
// candidates endpoint serves, including the seeded catalog's non-RFC ids, while still accepting
// production v4 ids. Strict @IsUUID would reject a candidate id the re-map drawer sends straight back.
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Body for PATCH /requests/:id/line-items/:lineId (US-E6-2-BE). Every field is optional so the
 * estimator can re-map the SKU, edit the quantity, set a manual price, or mark the line overridden
 * independently. The action rejects an empty body (no field set) with a 400.
 */
export class PatchLineItemDto {
  @ApiPropertyOptional({ description: 'Catalog SKU to re-map this line to', format: 'uuid' })
  @IsOptional()
  @Matches(UUID_SHAPE, { message: 'sku_id must be a valid id' })
  sku_id?: string;

  @ApiPropertyOptional({ description: 'Corrected quantity for the line', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ description: 'Manual unit price override in minor units', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  unit_price_minor?: number;

  @ApiPropertyOptional({
    description: 'Marks the line as manually overridden so the manual price is kept on recompute',
  })
  @IsOptional()
  @IsBoolean()
  override?: boolean;
}
