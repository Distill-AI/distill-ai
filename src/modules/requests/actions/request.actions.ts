import { Injectable, Logger } from '@nestjs/common';
import * as SYS_MSG from '@constants/system-messages';
import { EventsService } from '@modules/events/events.service';
import { getTimestamp } from '@common/utils/timestamp';
import { RequestModelAction } from '../requests.model-action';
import { ResumeReason } from '../enums/resume-reason.enum';
import { NodeRecoveryActions } from '../../pipeline/node-recovery.actions';
import type { Request } from '../entities/request.entity';
import type { ResumeResponsePayload } from '../interfaces/resume.interface';

@Injectable()
export class RequestActions {
  private readonly logger = new Logger(RequestActions.name);

  constructor(
    private readonly requestModelAction: RequestModelAction,
    private readonly nodeRecovery: NodeRecoveryActions,
    private readonly events: EventsService,
  ) {}

  async getRequestByIdWithNode(requestId: string): Promise<Request | null> {
    return this.requestModelAction.get({ identifierOptions: { id: requestId } });
  }

  async resumeRequest(requestId: string, reason: ResumeReason): Promise<ResumeResponsePayload> {
    const request = await this.requestModelAction.get({
      identifierOptions: { id: requestId },
    });
    if (!request) {
      this.logger.warn({ event: 'resume_request_not_found', requestId });
      return {
        request_id: requestId,
        resumed: false,
        resume_reason: reason,
        current_node: 'unknown',
      };
    }

    this.logger.log({
      event: 'resume_request_started',
      requestId,
      reason,
      current_node: request.current_node,
    });

    await this.nodeRecovery.resumeFromCurrentNode(requestId, reason);

    const resumedAt = getTimestamp();
    await this.events.emit({
      eventName: 'request.resumed',
      orgId: request.org_id,
      requestId,
      attributes: {
        type: 'request.resumed',
        timestamp: resumedAt,
        reason,
        resumed_from_node: request.current_node,
        resumed_at: resumedAt,
      },
    });
    this.logger.log({
      event: 'resume_request_completed',
      requestId,
      reason,
      message: SYS_MSG.RESUME_FROM_NODE(request.current_node),
    });

    return {
      request_id: requestId,
      resumed: true,
      resume_reason: reason,
      current_node: request.current_node,
    };
  }
}
