import type { MockedObject } from 'vitest';
import { SchedulerService } from '../scheduler.service';
import { JobModelAction } from '../../jobs/jobs.model-action';
import { JobsService } from '../../jobs/jobs.service';
import { JobStatus } from '../../jobs/enums/job-status.enum';
import type { Job } from '../../jobs/entities/job.entity';
import { JobType } from '../../jobs/enums/job-type.enum';
import { JobPriority } from '../../jobs/enums/job-priority.enum';

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-uuid',
    type: JobType.SEND_EMAIL,
    payload: {},
    priority: JobPriority.MEDIUM,
    status: JobStatus.PENDING,
    scheduled_at: null,
    recurring_interval: null,
    depends_on: null,
    retry_count: 0,
    max_retries: 3,
    priority_score: 2,
    error_message: null,
    next_run_at: null,
    started_at: null,
    completed_at: null,
    created_at: new Date(Date.now() - 10 * 60_000), // 10 min ago (past starvation threshold)
    updated_at: new Date(),
    ...overrides,
  } as Job;
}

describe('SchedulerService', () => {
  let service: SchedulerService;
  let jobModelAction: MockedObject<JobModelAction>;
  let jobsService: MockedObject<JobsService>;

  beforeEach(() => {
    jobModelAction = {
      findEligibleJobs: vi.fn(),
      findJobsByIds: vi.fn(),
      findStarvingPendingJobs: vi.fn(),
      findStalledJobs: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    } as unknown as MockedObject<JobModelAction>;

    jobsService = {
      enqueue: vi.fn().mockResolvedValue(undefined),
    } as unknown as MockedObject<JobsService>;

    service = new SchedulerService(jobModelAction, jobsService);
  });

  describe('runSchedulerSweep', () => {
    it('runs enqueue and boost in parallel and logs the result', async () => {
      jobModelAction.findEligibleJobs.mockResolvedValue([]);
      jobModelAction.findStarvingPendingJobs.mockResolvedValue([]);

      await expect(service.runSchedulerSweep()).resolves.toBeUndefined();

      expect(jobModelAction.findEligibleJobs).toHaveBeenCalled();
      expect(jobModelAction.findStarvingPendingJobs).toHaveBeenCalled();
    });

    it('enqueues eligible jobs returned by findEligibleJobs', async () => {
      const job = makeJob();
      jobModelAction.findEligibleJobs.mockResolvedValue([job]);
      jobModelAction.findStarvingPendingJobs.mockResolvedValue([]);

      await service.runSchedulerSweep();

      expect(jobsService.enqueue).toHaveBeenCalledWith(job);
    });

    it('skips a job whose DAG dependencies are not yet completed', async () => {
      const dep = makeJob({ id: 'dep-uuid', status: JobStatus.PENDING });
      const child = makeJob({ id: 'child-uuid', depends_on: ['dep-uuid'] });

      jobModelAction.findEligibleJobs.mockResolvedValue([child]);
      jobModelAction.findJobsByIds.mockResolvedValue([dep]);
      jobModelAction.findStarvingPendingJobs.mockResolvedValue([]);

      await service.runSchedulerSweep();

      expect(jobsService.enqueue).not.toHaveBeenCalled();
    });

    it('enqueues a job once all its DAG dependencies are completed', async () => {
      const dep = makeJob({ id: 'dep-uuid', status: JobStatus.COMPLETED });
      const child = makeJob({ id: 'child-uuid', depends_on: ['dep-uuid'] });

      jobModelAction.findEligibleJobs.mockResolvedValue([child]);
      jobModelAction.findJobsByIds.mockResolvedValue([dep]);
      jobModelAction.findStarvingPendingJobs.mockResolvedValue([]);

      await service.runSchedulerSweep();

      expect(jobsService.enqueue).toHaveBeenCalledWith(child);
    });

    it('boosts priority_score of starving pending jobs', async () => {
      const starving = makeJob({ id: 'starving-uuid' });
      jobModelAction.findEligibleJobs.mockResolvedValue([]);
      jobModelAction.findStarvingPendingJobs.mockResolvedValue([starving]);

      await service.runSchedulerSweep();

      expect(jobModelAction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          identifierOptions: { id: 'starving-uuid' },
          updatePayload: expect.objectContaining({ priority_score: expect.any(Number) }),
        }),
      );
    });

    it('does not boost if no starving jobs are found', async () => {
      jobModelAction.findEligibleJobs.mockResolvedValue([]);
      jobModelAction.findStarvingPendingJobs.mockResolvedValue([]);

      await service.runSchedulerSweep();

      expect(jobModelAction.update).not.toHaveBeenCalled();
    });
  });
});
