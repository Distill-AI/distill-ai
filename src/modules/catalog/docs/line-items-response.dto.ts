import { ApiProperty } from '@nestjs/swagger';

export class CandidateResponseDto {
  @ApiProperty({ example: 1 })
  rank: number;

  @ApiProperty({ example: 0.88 })
  confidence: number;

  @ApiProperty({ format: 'uuid' })
  sku_id: string;

  @ApiProperty({ example: 'HP5L' })
  sku_code: string;

  @ApiProperty({ example: 'Hydraulic Pump 5L' })
  name: string;

  @ApiProperty({ nullable: true, example: null })
  description: string | null;

  @ApiProperty({ example: 125000 })
  base_price_minor: number;

  @ApiProperty({ example: 'GBP' })
  currency: string;

  @ApiProperty({ nullable: true, example: 5 })
  lead_time_days: number | null;
}
