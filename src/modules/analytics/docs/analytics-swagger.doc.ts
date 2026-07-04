import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import * as SYS_MSG from '@constants/system-messages';

const summaryExample = {
  success: true,
  statusCode: 200,
  message: SYS_MSG.ANALYTICS_SUMMARY_RETRIEVED,
  data: {
    median_time_to_draft_seconds: 7010,
    median_time_to_draft_delta_pct: -12.5,
    zero_edit_approval_pct: 66.7,
    zero_edit_approval_delta_pts: 4.2,
    auto_eligible_false_negative_pct: 8.3,
    auto_eligible_false_negative_delta_pts: -1.1,
    quotes_this_week: 42,
    quotes_this_week_delta: 6,
    crash_recoveries_this_month: 3,
    confidence_distribution: { high_pct: 64, medium_pct: 27, low_pct: 9 },
    quote_funnel: { ingested: 120, drafted: 96, approved: 71, sent: 58 },
  },
};

/** Swagger for `GET /api/v1/analytics/summary`. */
export function AnalyticsSummaryDocs(): MethodDecorator {
  return applyDecorators(
    ApiOperation({
      summary: 'Dashboard KPI summary from audit events',
      description:
        'Computes median time-to-draft, zero-edit approval, auto-eligible false-negative rate, the ' +
        'Ingested→Drafted→Approved→Sent funnel, and the confidence distribution from the calling ' +
        "org's real events. Deltas compare the reporting window against the equal-length window " +
        'before it. Funnel counts are a single monotonic snapshot; rates with no denominator in the ' +
        'window return 0 rather than a division error.',
    }),
    ApiQuery({
      name: 'from',
      required: false,
      description: 'ISO-8601 window start (default: 7 days ago)',
    }),
    ApiQuery({
      name: 'to',
      required: false,
      description: 'ISO-8601 window end, exclusive (default: now)',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'KPI summary',
      schema: { example: summaryExample },
    }),
    ApiResponse({ status: HttpStatus.BAD_REQUEST, description: SYS_MSG.ANALYTICS_INVALID_RANGE }),
    ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: SYS_MSG.AUTH_UNAUTHORIZED }),
    ApiResponse({ status: HttpStatus.FORBIDDEN, description: SYS_MSG.AUTH_FORBIDDEN }),
  );
}
