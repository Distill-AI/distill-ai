import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

/**
 * Query for `GET /api/v1/analytics/summary`. `from`/`to` bound the primary reporting window; deltas
 * compare it against the immediately preceding window of equal length. Both are optional and
 * ISO-8601 validated (SEC-01); omitted, the window defaults to the last 7 days. No org/tenant input
 * is accepted here — the org is taken from the authenticated caller, so there is nothing to enumerate.
 */
export class AnalyticsQueryDto {
  @ApiPropertyOptional({
    description: 'Start of the reporting window (ISO-8601). Defaults to 7 days before `to`.',
    example: '2026-06-25T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    description: 'End of the reporting window (ISO-8601, exclusive). Defaults to now.',
    example: '2026-07-02T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
