import {
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
  Req,
  Sse,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { authConfig } from '@config/auth.config';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';
import * as SYS_MSG from '@constants/system-messages';
import { RequestsService } from '../services/requests.service';
import { StreamService } from '../services/stream.service';
import { RequestActions } from '../actions/request.actions';
import { ResumeReason } from '../enums/resume-reason.enum';
import { RequestEventsDocs, RequestResumeDocs } from '../docs/requests-swagger.doc';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';
import type { ResumeResponsePayload } from '../interfaces/resume.interface';

@Controller('requests')
export class RequestsController {
  private readonly logger = new Logger(RequestsController.name);

  constructor(
    private readonly requestsService: RequestsService,
    private readonly streamService: StreamService,
    private readonly requestActions: RequestActions,
  ) {}

  @Sse(':id/events')
  @Roles(Role.ESTIMATOR, Role.ADMIN)
  @RequestEventsDocs()
  async events(
    @Param('id') requestId: string,
    @Req() req: { user?: AuthUser },
  ): Promise<Observable<MessageEvent>> {
    const request = await this.requestsService.findByIdOrFail(requestId);

    if (authConfig.enabled) {
      const user = req.user;
      if (!user || request.org_id !== user.orgId) {
        throw new NotFoundException(SYS_MSG.REQUEST_NOT_FOUND(requestId));
      }
      this.logger.log({ event: SYS_MSG.STREAM_SUBSCRIBED, requestId, orgId: user.orgId });
    }

    return this.streamService.subscribe(requestId);
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ESTIMATOR, Role.ADMIN)
  @RequestResumeDocs()
  async resume(
    @Param('id') requestId: string,
    @Req() req: { user?: AuthUser },
  ): Promise<{
    statusCode: number;
    message: string;
    data: ResumeResponsePayload;
  }> {
    const request = await this.requestsService.findByIdOrFail(requestId);

    if (authConfig.enabled) {
      const user = req.user;
      if (!user || request.org_id !== user.orgId) {
        throw new NotFoundException(SYS_MSG.REQUEST_NOT_FOUND(requestId));
      }
    }

    const result = await this.requestActions.resumeRequest(requestId, ResumeReason.MANUAL);

    return {
      statusCode: HttpStatus.OK,
      message: SYS_MSG.RESUME_SUCCESS,
      data: result,
    };
  }
}
