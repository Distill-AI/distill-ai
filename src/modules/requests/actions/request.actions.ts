import { Injectable, Logger } from '@nestjs/common';
import * as SYS_MSG from '@constants/system-messages';
import { ResumeReason } from '../enums/resume-reason.enum';
import { RequestStatus } from '../enums/request-status.enum';
import { NodeRecoveryActions } from './node-recovery.actions';
import { ExtractionActions } from '@modules/extraction/actions/extraction.actions';
import { RequestModelAction } from '../requests.model-action';
import { EventsService } from '@modules/events/events.service';
import type { Request } from '../entities/request.entity';
import type { ResumeResponsePayload } from '../interfaces/resume.interface';
import type { DeclineResponsePayload } from '../interfaces/decline.interface';

@Injectable()
export class RequestActions {
  private readonly logger = new Logger(RequestActions.name);

  constructor(
    private readonly nodeRecovery: NodeRecoveryActions,
    private readonly extractionActions: ExtractionActions,
    private readonly requestModelAction: RequestModelAction,
    private readonly eventsService: EventsService,
  ) {}

  async resumeRequest(request: Request, reason: ResumeReason): Promise<ResumeResponsePayload> {
    this.logger.log({
      event: 'resume_request_started',
      requestId: request.id,
      reason,
      current_node: request.current_node,
    });

    const skipExtract = await this.extractionActions.hasValidExtraction(request.id);

    await this.nodeRecovery.resumeFromCurrentNode(request.id, reason, skipExtract);

    this.logger.log({
      event: 'resume_request_completed',
      requestId: request.id,
      reason,
      message: SYS_MSG.RESUME_FROM_NODE(request.current_node),
    });

    return {
      request_id: request.id,
      resumed: true,
      resume_reason: reason,
      current_node: request.current_node,
    };
  }

  async declineRequest(
    request: Request,
    reason: string,
    userId?: string,
  ): Promise<DeclineResponsePayload> {
    if (request.status === RequestStatus.DECLINED) {
      this.logger.log({
        event: 'decline_request_idempotent',
        requestId: request.id,
      });
      return {
        request_id: request.id,
        status: RequestStatus.DECLINED,
        reason,
      };
    }

    this.logger.log({
      event: 'decline_request_started',
      requestId: request.id,
      reason,
    });

    await this.requestModelAction.setStatus(request.id, RequestStatus.DECLINED);

    await this.eventsService.emit({
      eventName: 'request.declined',
      orgId: request.org_id,
      requestId: request.id,
      userId: userId ?? null,
      attributes: { reason },
    });

    this.logger.log({
      event: 'decline_request_completed',
      requestId: request.id,
      reason,
    });

    return {
      request_id: request.id,
      status: RequestStatus.DECLINED,
      reason,
    };
  }
}
