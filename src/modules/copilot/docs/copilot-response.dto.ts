import { ApiProperty } from '@nestjs/swagger';

/** Swagger schema for GET /requests/:id/copilot-explanation. Documentation only. */
export class CopilotExplanationResponseDto {
  @ApiProperty({ example: 'This quote requires manual review because...' })
  explanation: string;

  @ApiProperty({ example: false })
  degraded: boolean;
}

/** Swagger schema for one step of POST /requests/:id/copilot/ask's trace. Documentation only. */
export class AskCopilotTraceStepDto {
  @ApiProperty({ example: 'The routing explanation mentions a close pricing tie...' })
  thought: string;

  @ApiProperty({ example: 'search_catalog', nullable: true })
  tool: string | null;

  @ApiProperty({ example: { query: 'stainless steel hex bolt M8', limit: 5 }, nullable: true })
  input: unknown;

  @ApiProperty({ example: { candidates: [], degraded: false }, nullable: true })
  output: unknown;
}

/** Swagger schema for POST /requests/:id/copilot/ask. Documentation only. */
export class AskCopilotResponseDto {
  @ApiProperty({ example: 'This request needs manual review because...' })
  answer: string;

  @ApiProperty({ type: [AskCopilotTraceStepDto] })
  trace: AskCopilotTraceStepDto[];
}
