import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { env } from '@config/env';
import { ResumeReason } from '@modules/requests/enums/resume-reason.enum';
import { RequestModelAction } from '@modules/requests/requests.model-action';
import { NodeRecoveryActions } from '@modules/requests/actions/node-recovery.actions';

/**
 * Crash recovery (US-E8-4). Re-enqueues requests left mid-flight (status 'parsing' beyond the
 * stale window) so a worker crash never strands a request. Runs on a cron and once on boot.
 * The pipeline engine emits `request.resumed` when it processes the queued job.
 */
@Injectable()
export class RecoverySweep implements OnApplicationBootstrap {
  private readonly logger = new Logger(RecoverySweep.name);
  private readonly staleSeconds = env.SWEEP_STALE_SECONDS;

  constructor(
    private readonly requests: RequestModelAction,
    private readonly nodeRecovery: NodeRecoveryActions,
  ) {}

  /** Sweep for stale 'parsing' requests and re-enqueue them (Bull dedupes via the stable jobId). */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async sweep(): Promise<void> {
    const stale = await this.requests.findStaleParsing(this.staleSeconds);
    let enqueued = 0;
    for (const req of stale) {
      // Per-request isolation: one failed resume must not abort recovery of the rest.
      try {
        await this.nodeRecovery.resumeFromCurrentNode(req.id, ResumeReason.CRASH_RECOVERY);
        enqueued += 1;
      } catch (err) {
        this.logger.error({
          event: 'pipeline_recovery_enqueue_failed',
          requestId: req.id,
          error: (err as Error).message,
        });
      }
    }
    if (stale.length > 0) {
      this.logger.log({ event: 'pipeline_recovery_sweep', stale: stale.length, enqueued });
    }
  }

  /** On boot, resume anything left mid-flight by a previous crash. */
  async onApplicationBootstrap(): Promise<void> {
    await this.sweep();
  }
}
