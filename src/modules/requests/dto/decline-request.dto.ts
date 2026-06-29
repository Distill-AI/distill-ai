import { Transform } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import * as SYS_MSG from '@constants/system-messages';

export class DeclineRequestDto {
  @ApiProperty({
    description: 'Reason for declining the request',
    minLength: 1,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: SYS_MSG.DECLINE_REASON_REQUIRED })
  reason: string;
}
