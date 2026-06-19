import { ToolStatus } from '../enums/tools.enums';

export interface InvokeRequestDto {
  toolName: string;
  args: unknown;
}

export interface InvokeResponseDto<O = unknown> {
  status: ToolStatus;
  latency: number;
  result?: O;
  error?: string;
}
