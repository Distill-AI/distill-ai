import { Controller, Logger, NotFoundException, Param, Req, Sse } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';
import * as SYS_MSG from '@constants/system-messages';
import { RequestsService } from '../services/requests.service';
import { StreamService } from '../services/stream.service';
import { RequestEventsDocs } from '../docs/requests-swagger.doc';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';

@Controller('v1/requests')
export class RequestsController {
  private readonly logger = new Logger(RequestsController.name);

  constructor(
    private readonly requestsService: RequestsService,
    private readonly streamService: StreamService,
  ) {}

  @Sse(':id/events')
  @Roles(Role.ESTIMATOR, Role.ADMIN)
  @RequestEventsDocs()
  async events(
    @Param('id') requestId: string,
    @Req() req: { user?: AuthUser },
  ): Promise<Observable<MessageEvent>> {
    const request = await this.requestsService.findByIdOrFail(requestId);

    const user = req.user;
    if (!user || request.org_id !== user.orgId) {
      throw new NotFoundException(SYS_MSG.REQUEST_NOT_FOUND(requestId));
    }

    this.logger.log({ event: SYS_MSG.STREAM_SUBSCRIBED, requestId, orgId: user.orgId });

    return this.streamService.subscribe(requestId);
  }
}
