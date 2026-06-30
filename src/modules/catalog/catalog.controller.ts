import { Controller, Get, HttpStatus, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { authConfig } from '@config/auth.config';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { CatalogService } from './catalog.service';
import { SearchSkusDocs } from './docs/catalog-swagger.doc';
import * as SYS_MSG from '@constants/system-messages';

@ApiTags('Catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  /** Manual catalog search for the re-map drawer, scoped to the caller's org (US-E6-2 FR-1). */
  @Get('skus')
  @Roles(Role.ESTIMATOR, Role.ADMIN)
  @SearchSkusDocs()
  async searchSkus(
    @Query('q') q: string | undefined,
    @Query('limit') rawLimit: string | undefined,
    @Req() req: { user?: AuthUser },
  ) {
    let orgId: string | undefined;
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

    const limit = rawLimit ? Number.parseInt(rawLimit, 10) : undefined;
    const data = await this.catalogService.searchSkus(
      q ?? '',
      orgId,
      Number.isFinite(limit) ? (limit as number) : undefined,
    );

    return { statusCode: HttpStatus.OK, message: SYS_MSG.SKUS_RETRIEVED, data };
  }
}
