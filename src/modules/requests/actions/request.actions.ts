import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
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

const DECLINE_SOURCES = [
  RequestStatus.NEEDS_REVIEW,
  RequestStatus.NEEDS_CLARIFICATION,
  RequestStatus.PRICED,
  RequestStatus.READY,
  RequestStatus.FAILED,
];

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
    const originalStatus = request.status;

    const didTransition = await this.requestModelAction.trySetStatus(
      request.id,
      RequestStatus.DECLINED,
      DECLINE_SOURCES,
    );

    if (!didTransition) {
      const current = await this.requestModelAction.get({
        identifierOptions: { id: request.id },
      });
      if (current?.status === RequestStatus.DECLINED) {
        this.logger.log({
          event: 'decline_request_idempotent',
          requestId: request.id,
          status: RequestStatus.DECLINED,
        });
        return {
          request_id: request.id,
          status: RequestStatus.DECLINED,
          reason,
        };
      }
      throw new HttpException(
        `Request ${request.id} cannot be declined from its current status`,
        HttpStatus.CONFLICT,
      );
    }

    this.logger.log({
      event: 'decline_request_started',
      requestId: request.id,
      reason,
    });

    try {
      await this.eventsService.emit({
        eventName: 'request.declined',
        orgId: request.org_id,
        requestId: request.id,
        userId: userId ?? null,
        attributes: { reason },
      });
    } catch (err) {
      this.logger.error({
        event: 'decline_audit_failed',
        requestId: request.id,
        error: err instanceof Error ? err.message : String(err),
      });
      await this.requestModelAction.trySetStatus(request.id, originalStatus);
      throw err;
    }

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
