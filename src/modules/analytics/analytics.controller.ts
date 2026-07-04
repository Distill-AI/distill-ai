import { Controller, Get, HttpCode, HttpStatus, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { authConfig } from '@config/auth.config';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import { Roles } from '@modules/auth/decorators/roles.decorator';
import { Role } from '@modules/auth/enums/role.enum';
import type { AuthUser } from '@modules/auth/interfaces/auth-user.interface';
import { DEMO_ORG_ID } from '@modules/ingestion/ingestion.constants';
import * as SYS_MSG from '@constants/system-messages';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { AnalyticsSummaryDocs } from './docs/analytics-swagger.doc';
import type { AnalyticsSummary } from './interfaces/analytics-summary.interface';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** Dashboard KPIs computed from the caller org's real events (US-E7-2-BE). */
  @Get('summary')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ESTIMATOR, Role.ADMIN)
  @AnalyticsSummaryDocs()
  async summary(
    @Query() query: AnalyticsQueryDto,
    @Req() req: { user?: AuthUser },
  ): Promise<{ statusCode: number; message: string; data: AnalyticsSummary }> {
    // Org comes from the authenticated caller, never the request body (SEC-01). Branch explicitly on
    // auth like the other read endpoints (line-items, clarification): when auth is on, fail closed if
    // the caller has no org rather than silently falling back to the demo org; when off, use the demo org.
    let orgId = DEMO_ORG_ID;
    if (authConfig.enabled) {
      const user = req.user;
      if (!user) {
        throw new CustomHttpException(SYS_MSG.AUTH_UNAUTHORIZED, HttpStatus.UNAUTHORIZED);
      }
      if (!user.orgId) {
        throw new CustomHttpException(SYS_MSG.AUTH_FORBIDDEN, HttpStatus.FORBIDDEN);
      }
      orgId = user.orgId;
    }

    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - SEVEN_DAYS_MS);
    if (from.getTime() >= to.getTime()) {
      throw new CustomHttpException(SYS_MSG.ANALYTICS_INVALID_RANGE, HttpStatus.BAD_REQUEST);
    }

    const data = await this.analytics.getSummary(orgId, { from, to });
    return { statusCode: HttpStatus.OK, message: SYS_MSG.ANALYTICS_SUMMARY_RETRIEVED, data };
  }
}
