import { Controller, Get, HttpStatus, NotFoundException, Param, Req } from '@nestjs/common';
import { authConfig } from '@config/auth.config';
import * as SYS_MSG from '@constants/system-messages';
import { RequestsService } from '@modules/requests/services/requests.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { CopilotService } from './copilot.service';
import { CopilotExplanationDocs } from './docs/copilot-swagger.doc';

@Controller('requests')
export class CopilotController {
  constructor(
    private readonly requestsService: RequestsService,
    private readonly copilotService: CopilotService,
  ) {}

  /** Returns the advisory routing explanation for a request; 404s for cross-org or missing requests, same as GET /requests/:id. */
  @Get(':id/copilot-explanation')
  @Roles(Role.ESTIMATOR, Role.ADMIN)
  @CopilotExplanationDocs()
  async getExplanation(@Param('id') requestId: string, @Req() req: { user?: AuthUser }) {
    const request = await this.requestsService.findByIdOrFail(requestId);

    if (authConfig.enabled) {
      const user = req.user;
      if (!user || request.org_id !== user.orgId) {
        throw new NotFoundException(SYS_MSG.REQUEST_NOT_FOUND(requestId));
      }
    }

    const data = await this.copilotService.getExplanation(request);

    return {
      statusCode: HttpStatus.OK,
      message: SYS_MSG.COPILOT_EXPLANATION_RETRIEVED,
      data,
    };
  }
}
