import { ToolStatus } from '../enums/tools.enums';
import { IsDefined, IsNotEmpty, IsString } from 'class-validator';

export class InvokeRequestDto {
  @IsString()
  @IsNotEmpty()
  toolName: string;

  @IsDefined()
  args: unknown;
}

export interface InvokeResponseDto<O = unknown> {
  status: ToolStatus;
  latency: number;
  result?: O;
  error?: string;
}
