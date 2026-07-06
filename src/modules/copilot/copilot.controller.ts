import {
  Body,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { authConfig } from '@config/auth.config';
import * as SYS_MSG from '@constants/system-messages';
import { RequestsService } from '@modules/requests/services/requests.service';
import { Roles } from '@modules/auth/decorators/roles.decorator';
import { Role } from '@modules/auth/enums/role.enum';
import type { AuthUser } from '@modules/auth/interfaces/auth-user.interface';
import { AgenticCopilotService } from './agentic/agentic-copilot.service';
import { AskCopilotDto } from './dto/ask-copilot.dto';
import { CopilotService } from './copilot.service';
import { AskCopilotDocs, CopilotExplanationDocs } from './docs/copilot-swagger.doc';

@Controller('requests')
export class CopilotController {
  constructor(
    private readonly requestsService: RequestsService,
    private readonly copilotService: CopilotService,
    private readonly agenticCopilotService: AgenticCopilotService,
  ) {}

  /** Returns the advisory routing explanation for a request; 404s for cross-org or missing requests, same as GET /requests/:id. */
  @Get(':id/copilot-explanation')
  @Roles(Role.ESTIMATOR, Role.ADMIN)
  @CopilotExplanationDocs()
  async getExplanation(
    @Param('id', ParseUUIDPipe) requestId: string,
    @Req() req: { user?: AuthUser },
  ) {
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

  /** Answers a free-text question about a request via the agentic copilot; 404s for cross-org, missing requests, or a disabled feature flag. */
  @Post(':id/copilot/ask')
  @Roles(Role.ESTIMATOR, Role.ADMIN)
  @AskCopilotDocs()
  async ask(
    @Param('id', ParseUUIDPipe) requestId: string,
    @Body() dto: AskCopilotDto,
    @Req() req: { user?: AuthUser },
  ) {
    const request = await this.requestsService.findByIdOrFail(requestId);

    if (authConfig.enabled) {
      const user = req.user;
      if (!user || request.org_id !== user.orgId) {
        throw new NotFoundException(SYS_MSG.REQUEST_NOT_FOUND(requestId));
      }
    }

    const data = await this.agenticCopilotService.ask(request, dto.question);

    return {
      statusCode: HttpStatus.OK,
      message: SYS_MSG.AGENTIC_COPILOT_ANSWERED,
      data,
    };
  }
}
