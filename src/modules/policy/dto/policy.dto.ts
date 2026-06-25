import { IsArray, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class EvaluatePolicyDto {
  @IsUUID()
  orgId: string;

  @IsNumber()
  @Min(0)
  total: number;

  @IsNumber()
  @Min(0)
  lineItems: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categories?: string[];
}

export class ReloadPolicyRulesDto {
  @IsString()
  @IsOptional()
  @MaxLength(512)
  configPath?: string;
}
