import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsInt,
  IsObject,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobType, RecurringInterval } from '../enums/job-type.enum';
import { JobPriority } from '../enums/job-priority.enum';

export class CreateJobDto {
  @ApiProperty({ enum: JobType })
  @IsEnum(JobType)
  type!: JobType;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiPropertyOptional({ enum: JobPriority, default: JobPriority.MEDIUM })
  @IsOptional()
  @IsEnum(JobPriority)
  priority?: JobPriority;

  @ApiPropertyOptional({ description: 'ISO 8601 timestamp — defer until this time' })
  @IsOptional()
  @IsISO8601()
  scheduled_at?: string;

  @ApiPropertyOptional({ enum: RecurringInterval })
  @IsOptional()
  @IsEnum(RecurringInterval)
  recurring_interval?: RecurringInterval;

  @ApiPropertyOptional({ type: [String], description: 'Job IDs that must complete first' })
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  depends_on?: string[];

  @ApiPropertyOptional({
    default: 3,
    minimum: 0,
    description: 'Override the default max retry count',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  max_retries?: number;
}
