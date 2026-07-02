import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bull';
import { PIPELINE_JOBS, QUEUES } from '@common/constants/queue.constants';
import { ResumeReason } from '@modules/requests/enums/resume-reason.enum';
import { ATTR_REQUEST_ID, injectTraceContext, withSpan } from '@common/telemetry/telemetry';

@Injectable()
export class NodeRecoveryActions {
  private readonly logger = new Logger(NodeRecoveryActions.name);

  constructor(@InjectQueue(QUEUES.PIPELINE) private readonly queue: Queue) {}

  async resumeFromCurrentNode(
    requestId: string,
    reason: ResumeReason,
    skipExtract?: boolean,
  ): Promise<void> {
    this.logger.log({
      event: 'resume_from_node',
      requestId,
      reason,
    });

    await withSpan('pipeline.enqueue', { [ATTR_REQUEST_ID]: requestId }, async () => {
      // A crash-recovery sweep has no active span, so the resumed run traces as a fresh root that
      // still carries request_id (EC-02); a manual resume links to its request span.
      await this.queue.add(
        PIPELINE_JOBS.RUN,
        { requestId, reason, skipExtract, ...injectTraceContext() },
        { jobId: `pipeline:${requestId}` },
      );
    });
  }
}
