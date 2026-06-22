import { Injectable, Logger } from '@nestjs/common';
import { PipelineRunner } from '@modules/pipeline/pipeline.runner';
import { ResumeReason } from '@modules/requests/enums/resume-reason.enum';

@Injectable()
export class NodeRecoveryActions {
  private readonly logger = new Logger(NodeRecoveryActions.name);

  constructor(private readonly runner: PipelineRunner) {}

  async resumeFromCurrentNode(requestId: string, reason: ResumeReason): Promise<void> {
    this.logger.log({
      event: 'resume_from_node',
      requestId,
      reason,
    });

    await this.runner.enqueue(requestId);
  }
}
