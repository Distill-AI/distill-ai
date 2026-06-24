import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import * as SYS_MSG from '@constants/system-messages';

export class PasteAttachmentDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: SYS_MSG.ATTACHMENT_PASTE_EMPTY })
  @MaxLength(50_000)
  content: string;
}
