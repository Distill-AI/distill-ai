import { IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class EvaluatePriceDto {
  @IsUUID()
  orgId: string;

  @IsNumber()
  @Min(0)
  total: number;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  marginPercent: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent: number;
}

export class ReloadRulesDto {
  @IsString()
  @IsOptional()
  @MaxLength(512)
  configPath?: string;
}
