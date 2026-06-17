import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AbstractModelAction } from '@common/model-action/abstract.model-action';
import { Job } from './entities/job.entity';
import { JobStatus } from './enums/job-status.enum';

@Injectable()
export class JobModelAction extends AbstractModelAction<Job> {
  constructor(
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
  ) {
    super(jobRepository, Job);
  }

  /** Atomically claims a pending job for a worker. Returns false if another worker won the race. */
  async claimJob(jobId: string, leaseExpiresAt: Date): Promise<boolean> {
    const result = await this.jobRepository
      .createQueryBuilder()
      .update(Job)
      .set({
        status: JobStatus.PROCESSING,
        started_at: new Date(),
        lease_expires_at: leaseExpiresAt,
      })
      .where('id = :jobId AND status = :status', { jobId, status: JobStatus.PENDING })
      .execute();
    return (result.affected ?? 0) > 0;
  }

  /** Pending jobs where scheduled_at has passed (or is null), ordered by priority score. */
  async findEligibleJobs(limit: number): Promise<Job[]> {
    return this.jobRepository
      .createQueryBuilder('job')
      .where('job.status = :status', { status: JobStatus.PENDING })
      .andWhere('(job.scheduled_at IS NULL OR job.scheduled_at <= :now)', { now: new Date() })
      .orderBy('job.priority_score', 'ASC')
      .addOrderBy('job.created_at', 'ASC')
      .limit(limit)
      .getMany();
  }

  /** Fetch multiple jobs by their IDs in one query. */
  async findJobsByIds(ids: string[]): Promise<Job[]> {
    if (ids.length === 0) return [];
    return this.jobRepository.findBy({ id: In(ids) });
  }

  /** Pending jobs that have been waiting longer than thresholdMs (starvation candidates). */
  async findStarvingPendingJobs(thresholdMs: number, limit: number): Promise<Job[]> {
    const cutoff = new Date(Date.now() - thresholdMs);
    return this.jobRepository
      .createQueryBuilder('job')
      .where('job.status = :status', { status: JobStatus.PENDING })
      .andWhere('job.created_at <= :cutoff', { cutoff })
      .orderBy('job.created_at', 'ASC')
      .limit(limit)
      .getMany();
  }

  /** Processing jobs whose lease has expired — safe to reset to PENDING for re-claim. */
  async findStalledJobs(limit: number): Promise<Job[]> {
    return this.jobRepository
      .createQueryBuilder('job')
      .where('job.status = :status', { status: JobStatus.PROCESSING })
      .andWhere('job.lease_expires_at < :now', { now: new Date() })
      .orderBy('job.created_at', 'ASC')
      .limit(limit)
      .getMany();
  }

  /** Count jobs grouped by status — used for the dashboard stats endpoint. */
  async countByStatus(): Promise<Record<JobStatus, number>> {
    const rows = await this.jobRepository
      .createQueryBuilder('job')
      .select('job.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('job.status')
      .getRawMany<{ status: string; count: string }>();

    const result = Object.values(JobStatus).reduce(
      (acc, s) => ({ ...acc, [s]: 0 }),
      {} as Record<JobStatus, number>,
    );
    for (const { status, count } of rows) {
      result[status as JobStatus] = parseInt(count, 10);
    }
    return result;
  }
}
