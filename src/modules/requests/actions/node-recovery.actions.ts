import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bull';
import { PIPELINE_JOBS, QUEUES } from '@common/constants/queue.constants';
import { ResumeReason } from '@modules/requests/enums/resume-reason.enum';
import { enqueueWithTrace } from '@common/telemetry/traced-enqueue';

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

    // A crash-recovery sweep has no active span, so the resumed run traces as a fresh root that still
    // carries request_id (EC-02); a manual resume links to its request span. See enqueueWithTrace.
    await enqueueWithTrace(
      this.queue,
      PIPELINE_JOBS.RUN,
      { requestId, reason, skipExtract },
      { jobId: `pipeline:${requestId}` },
    );
  }
}
