import {
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { authConfig } from '@config/auth.config';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { LineItemsService } from './line-items.service';
import { GetCandidatesDocs } from './docs/line-items-swagger.doc';
import * as SYS_MSG from '@constants/system-messages';

@Controller('line-items')
export class LineItemsController {
  constructor(private readonly lineItemsService: LineItemsService) {}

  /** Returns ranked catalog candidates for one line item, scoped to the caller's org. */
  @Get(':lineId/candidates')
  @Roles(Role.ESTIMATOR, Role.ADMIN)
  @GetCandidatesDocs()
  async getCandidates(
    @Param('lineId', new ParseUUIDPipe({ version: '4' })) lineId: string,
    @Req() req: { user?: AuthUser },
  ) {
    let orgId: string | undefined;
    if (authConfig.enabled) {
      const user = req.user;
      if (!user || !user.orgId) {
        throw new NotFoundException(SYS_MSG.LINE_ITEM_NOT_FOUND(lineId));
      }
      orgId = user.orgId;
    }

    const data = await this.lineItemsService.getCandidates(lineId, orgId);

    return {
      statusCode: HttpStatus.OK,
      message: SYS_MSG.CANDIDATES_RETRIEVED,
      data,
    };
  }
}
