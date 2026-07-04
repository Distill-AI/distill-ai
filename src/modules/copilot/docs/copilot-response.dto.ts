import { ApiProperty } from '@nestjs/swagger';

/** Swagger schema for GET /requests/:id/copilot-explanation. Documentation only. */
export class CopilotExplanationResponseDto {
  @ApiProperty({ example: 'This quote requires manual review because...' })
  explanation: string;

  @ApiProperty({ example: false })
  degraded: boolean;
}
