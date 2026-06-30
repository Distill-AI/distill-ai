import { ArrayMinSize, IsArray, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateDraftDto {
  @ApiProperty({
    description: 'List of detected gaps requiring clarification',
    example: ['Missing delivery date', 'No contact name provided'],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  gaps: string[];
}
export class UpdateDraftDto {
  @ApiPropertyOptional({ description: 'Updated subject line' })
  @IsOptional()
  @IsString()
  draft_subject?: string;

  @ApiPropertyOptional({ description: 'Updated body text' })
  @IsOptional()
  @IsString()
  draft_body?: string;
}

export class SendClarificationDto {} // reserved; sent_by is populated from auth context
