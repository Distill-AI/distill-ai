import type { MockedObject, MockInstance } from 'vitest';
import { JobWorkerProcessor } from '../job-worker.processor';
import { JobModelAction } from '@modules/jobs/jobs.model-action';
import { DlqService } from '@modules/dlq/dlq.service';
import { EmailSimulationHandler } from '@queue/handlers/email-simulation.handler';
import { WebhookDeliveryHandler } from '@queue/handlers/webhook-delivery.handler';
import { LogProcessingHandler } from '@queue/handlers/log-processing.handler';
import { BackoffService } from '@worker/backoff.service';
import { JobStatus } from '@modules/jobs/enums/job-status.enum';
import { JobType } from '@modules/jobs/enums/job-type.enum';
import { JobPriority } from '@modules/jobs/enums/job-priority.enum';
import type { Job } from '@modules/jobs/entities/job.entity';
import type { Job as BullJob } from 'bull';

vi.mock('@queue/handlers/email-simulation.handler');
vi.mock('@queue/handlers/webhook-delivery.handler');
vi.mock('@queue/handlers/log-processing.handler');

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-uuid',
    type: JobType.SEND_EMAIL,
    payload: { to: 'a@b.com', subject: 'Hi' },
    priority: JobPriority.MEDIUM,
    status: JobStatus.PENDING,
    scheduled_at: null,
    recurring_interval: null,
    next_run_at: null,
    depends_on: null,
    retry_count: 0,
    max_retries: 3,
    priority_score: 2,
    error_message: null,
    started_at: null,
    completed_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as Job;
}

function makeBullJob(jobId: string, overrides: Partial<BullJob> = {}): BullJob<{ jobId: string }> {
  return {
    id: 'bull-1',
    data: { jobId },
    opts: { attempts: 3 },
    attemptsMade: 0,
    processedOn: Date.now(),
    finishedOn: Date.now(),
    ...overrides,
  } as unknown as BullJob<{ jobId: string }>;
}

describe('JobWorkerProcessor', () => {
  let processor: JobWorkerProcessor;
  let jobModelAction: MockedObject<JobModelAction>;
  let dlqService: MockedObject<DlqService>;
  let emailHandler: MockedObject<EmailSimulationHandler>;
  let webhookHandler: MockedObject<WebhookDeliveryHandler>;
  let logHandler: MockedObject<LogProcessingHandler>;
  let backoffService: MockedObject<BackoffService>;

  beforeEach(() => {
    jobModelAction = {
      get: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
      claimJob: vi.fn().mockResolvedValue(true),
      findJobsByIds: vi.fn(),
    } as unknown as MockedObject<JobModelAction>;

    dlqService = {
      moveToDlq: vi.fn().mockResolvedValue({}),
    } as unknown as MockedObject<DlqService>;

    emailHandler = {
      handle: vi.fn().mockResolvedValue(undefined),
    } as unknown as MockedObject<EmailSimulationHandler>;

    webhookHandler = {
      handle: vi.fn().mockResolvedValue(undefined),
    } as unknown as MockedObject<WebhookDeliveryHandler>;

    logHandler = {
      handle: vi.fn().mockResolvedValue(undefined),
    } as unknown as MockedObject<LogProcessingHandler>;

    backoffService = {
      calculateWaitMs: vi.fn().mockReturnValue(1000),
    } as unknown as MockedObject<BackoffService>;

    const sseService = {
      emit: vi.fn(),
    } as unknown as import('../../../sse/sse.service').SseService;
    processor = new JobWorkerProcessor(
      jobModelAction,
      dlqService,
      backoffService,
      sseService,
      emailHandler,
      webhookHandler,
      logHandler,
    );
  });

  describe('handleJob', () => {
    it('claims job atomically, processes, and marks COMPLETED', async () => {
      const job = makeJob();
      jobModelAction.get.mockResolvedValue(job);

      await processor.handleJob(makeBullJob('job-uuid'));

      expect(jobModelAction.claimJob).toHaveBeenCalledTimes(1);
      expect(jobModelAction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          updatePayload: expect.objectContaining({ status: JobStatus.COMPLETED }),
        }),
      );
    });

    it('returns early without processing when atomic claim fails', async () => {
      jobModelAction.get.mockResolvedValue(makeJob());
      jobModelAction.claimJob.mockResolvedValue(false);

      await processor.handleJob(makeBullJob('job-uuid'));

      expect(emailHandler.handle).not.toHaveBeenCalled();
      expect(jobModelAction.update).not.toHaveBeenCalled();
    });

    it('returns early if job is not found in DB', async () => {
      jobModelAction.get.mockResolvedValue(null);

      await processor.handleJob(makeBullJob('job-uuid'));

      expect(jobModelAction.update).not.toHaveBeenCalled();
    });

    it('skips processing if job status is CANCELLED', async () => {
      jobModelAction.get.mockResolvedValue(makeJob({ status: JobStatus.CANCELLED }));

      await processor.handleJob(makeBullJob('job-uuid'));

      expect(jobModelAction.update).not.toHaveBeenCalled();
    });

    it('skips processing if job status is already COMPLETED', async () => {
      jobModelAction.get.mockResolvedValue(makeJob({ status: JobStatus.COMPLETED }));

      await processor.handleJob(makeBullJob('job-uuid'));

      expect(jobModelAction.update).not.toHaveBeenCalled();
    });

    it('skips processing and does not enqueue if DAG dependencies are unmet', async () => {
      const dep = makeJob({ id: 'dep-uuid', status: JobStatus.PENDING });
      const job = makeJob({ depends_on: ['dep-uuid'] });
      jobModelAction.get.mockResolvedValue(job);
      jobModelAction.findJobsByIds.mockResolvedValue([dep]);

      await processor.handleJob(makeBullJob('job-uuid'));

      expect(jobModelAction.update).not.toHaveBeenCalled();
    });

    it('schedules the next recurrence when a recurring job completes', async () => {
      const job = makeJob({ recurring_interval: 'every_1_hour' as never });
      jobModelAction.get.mockResolvedValue(job);

      await processor.handleJob(makeBullJob('job-uuid'));

      expect(jobModelAction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          createPayload: expect.objectContaining({
            recurring_interval: 'every_1_hour',
            status: JobStatus.PENDING,
          }),
        }),
      );
    });

    it('dispatches webhook_delivery jobs to WebhookDeliveryHandler', async () => {
      const job = makeJob({
        type: JobType.WEBHOOK_DELIVERY,
        payload: { url: 'https://example.com/hook', method: 'POST' },
      });
      jobModelAction.get.mockResolvedValue(job);

      await processor.handleJob(makeBullJob('job-uuid'));

      expect(webhookHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://example.com/hook' }),
      );
    });

    it('dispatches log_processing jobs to LogProcessingHandler', async () => {
      const job = makeJob({
        type: JobType.LOG_PROCESSING,
        payload: { source: 'api-gateway', level: 'info', message: 'Request received' },
      });
      jobModelAction.get.mockResolvedValue(job);

      await processor.handleJob(makeBullJob('job-uuid'));

      expect(logHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'api-gateway' }),
      );
    });

    it('propagates dispatch errors so Bull can handle retries', async () => {
      const job = makeJob({ type: 'unknown_type' as never });
      jobModelAction.get.mockResolvedValue(job);

      await expect(processor.handleJob(makeBullJob('job-uuid'))).rejects.toThrow(
        'Unknown job type: unknown_type',
      );
    });
  });

  describe('onFailed', () => {
    it('moves job to DLQ and marks FAILED when all retries are exhausted', async () => {
      const job = makeJob();
      jobModelAction.get.mockResolvedValue(job);
      const bullJob = makeBullJob('job-uuid', { attemptsMade: 3, opts: { attempts: 3 } } as never);

      await processor.onFailed(bullJob, new Error('boom'));

      expect(jobModelAction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          updatePayload: expect.objectContaining({ status: JobStatus.FAILED }),
        }),
      );
      expect(dlqService.moveToDlq).toHaveBeenCalledWith(
        expect.objectContaining({ originalJobId: 'job-uuid', errorMessage: 'boom' }),
      );
    });

    it('does not move to DLQ when retries are still remaining', async () => {
      const bullJob = makeBullJob('job-uuid', { attemptsMade: 1, opts: { attempts: 3 } } as never);

      await processor.onFailed(bullJob, new Error('transient'));

      expect(dlqService.moveToDlq).not.toHaveBeenCalled();
      expect(jobModelAction.update).not.toHaveBeenCalled();
    });
  });
});

// suppress unused import — MockInstance is used as a type reference in vi.mock factories
void (null as unknown as MockInstance);
