import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { RequestChannel } from '@modules/requests/enums/request-channel.enum';

/**
 * Text fields of a `POST /requests` multipart submission. Files arrive via the FilesInterceptor, not
 * this DTO. `channel` is optional: when omitted it is inferred (files present -> upload, otherwise
 * paste -> email). Pasted RFQ text goes in `source_body` (US-E1-2-T2).
 */
export class CreateRequestDto {
  @IsOptional()
  @IsEnum(RequestChannel)
  channel?: RequestChannel;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  source_subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  source_body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  sender_company?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  sender_contact?: string;

  @IsOptional()
  @IsEmail()
  sender_email?: string;
}
