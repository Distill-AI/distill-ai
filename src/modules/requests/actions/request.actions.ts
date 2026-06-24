import { Injectable, Logger } from '@nestjs/common';
import * as SYS_MSG from '@constants/system-messages';
import { ResumeReason } from '../enums/resume-reason.enum';
import { NodeRecoveryActions } from './node-recovery.actions';
import { ExtractionActions } from '@modules/extraction/actions/extraction.actions';
import type { Request } from '../entities/request.entity';
import type { ResumeResponsePayload } from '../interfaces/resume.interface';

@Injectable()
export class RequestActions {
  private readonly logger = new Logger(RequestActions.name);

  constructor(
    private readonly nodeRecovery: NodeRecoveryActions,
    private readonly extractionActions: ExtractionActions,
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
}
