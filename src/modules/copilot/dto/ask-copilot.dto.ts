import { Transform } from 'class-transformer';
import { IsDefined, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import * as SYS_MSG from '@constants/system-messages';

export class AskCopilotDto {
  @ApiProperty({
    description: 'Free-text question about the request',
    minLength: 1,
    maxLength: 1000,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsDefined({ message: SYS_MSG.AGENTIC_COPILOT_QUESTION_REQUIRED })
  @IsString({ message: SYS_MSG.AGENTIC_COPILOT_QUESTION_REQUIRED })
  @MinLength(1, { message: SYS_MSG.AGENTIC_COPILOT_QUESTION_REQUIRED })
  @MaxLength(1000, { message: SYS_MSG.AGENTIC_COPILOT_QUESTION_REQUIRED })
  question: string;
}
