import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RequestModelAction } from '@modules/requests/requests.model-action';
import { PipelineRunner } from './pipeline.runner';

/**
 * Crash recovery (US-E8-4). Re-enqueues requests left mid-flight (status 'parsing' beyond the
 * stale window) so a worker crash never strands a request. Runs on a cron and once on boot.
 */
@Injectable()
export class RecoverySweep implements OnApplicationBootstrap {
  private readonly logger = new Logger(RecoverySweep.name);
  private readonly staleSeconds = Number(process.env.SWEEP_STALE_SECONDS ?? 60);

  constructor(
    private readonly requests: RequestModelAction,
    private readonly runner: PipelineRunner,
  ) {}

  /** Sweep for stale 'parsing' requests and re-enqueue them (Bull dedupes via the stable jobId). */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async sweep(): Promise<void> {
    const stale = await this.requests.findStaleParsing(this.staleSeconds);
    for (const req of stale) {
      await this.runner.enqueue(req.id);
    }
    if (stale.length > 0) {
      this.logger.log({ event: 'pipeline_recovery_sweep', recovered: stale.length });
    }
  }

  /** On boot, resume anything left mid-flight by a previous crash. */
  async onApplicationBootstrap(): Promise<void> {
    await this.sweep();
  }
}
