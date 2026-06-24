import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import * as SYS_MSG from '@constants/system-messages';

export class PasteAttachmentDto {
  @ApiProperty({
    description: 'Manually pasted text content for the attachment',
    maxLength: 50_000,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: SYS_MSG.ATTACHMENT_PASTE_EMPTY })
  @MaxLength(50_000)
  content: string;
}
