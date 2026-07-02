import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, In, Repository, FindOptionsWhere } from 'typeorm';
import { AbstractModelAction } from '@common/model-action/abstract.model-action';
import { Request } from './entities/request.entity';
import { CurrentNode } from './enums/current-node.enum';
import { RequestStatus } from './enums/request-status.enum';

const TERMINAL_STATUSES = [RequestStatus.DECLINED, RequestStatus.SENT];

/** Data-access for `requests`, including the pipeline-engine helpers (US-E8-4). */
@Injectable()
export class RequestModelAction extends AbstractModelAction<Request> {
  constructor(
    @InjectRepository(Request)
    private readonly requestRepository: Repository<Request>,
  ) {
    super(requestRepository, Request);
  }

  /** Advance the persisted checkpoint to the given node (written between nodes by the engine). */
  async setCurrentNode(requestId: string, node: CurrentNode): Promise<void> {
    await this.requestRepository.update({ id: requestId }, { current_node: node });
  }

  /**
   * Set the working/terminal status of a request. Silently skipped when the
   * current status is already terminal (DECLINED / SENT) to prevent race
   * conditions where the engine or a concurrent action overwrites a terminal
   * state.
   */
  async setStatus(requestId: string, status: RequestStatus): Promise<void> {
    await this.requestRepository.update(
      { id: requestId, status: Not(In(TERMINAL_STATUSES)) },
      { status },
    );
  }

  /**
   * Atomically set status only if the current value is not already {@link status}
   * and, when {@link validSources} is provided, only when the current value is
   * one of those source states.
   * Returns `true` when a row was actually updated (the transition won); `false`
   * when the status was already {@link status} or not in a valid source (no-op).
   * Use this for terminal transitions where only the first caller should win
   * (e.g. decline) to avoid duplicate audit events.
   */
  async trySetStatus(
    requestId: string,
    status: RequestStatus,
    validSources?: RequestStatus[],
  ): Promise<boolean> {
    const where: FindOptionsWhere<Request> = { id: requestId };
    where.status = validSources?.length ? In(validSources) : Not(status);
    const result = await this.requestRepository.update(where, { status });
    return (result.affected ?? 0) > 0;
  }

  /**
   * Mark a request as actively processing: set status to 'parsing' and stamp `processing_started_at`
   * from the database clock (`NOW()`), not the worker's, so it can't drift relative to the `NOW()`
   * that `findStaleParsing` compares against (#96). The stamp is what the recovery sweep checks, so
   * without it a crashed run can never be detected. Re-stamped on every run/resume so an actively
   * processing request is not swept while it is still making progress. Silently skipped when the
   * current status is terminal (DECLINED / SENT).
   */
  async markProcessing(requestId: string): Promise<void> {
    await this.requestRepository.update(
      { id: requestId, status: Not(In(TERMINAL_STATUSES)) },
      { status: RequestStatus.PARSING, processing_started_at: () => 'NOW()' },
    );
  }

  /**
   * Requests stuck in `parsing` past the stale window that the recovery sweep should re-enqueue.
   * Both age checks use the database clock (`NOW()`), never a caller-computed cutoff, so a worker/DB
   * clock skew can't make the sweep miss a real crash or grab a request still in its intake window
   * (#96). Two cases: a run that stamped `processing_started_at` then went quiet, or one stranded at
   * intake (the pipeline enqueue never landed, e.g. a crash between commit and enqueue) where
   * `processing_started_at` is still null and only `created_at` bounds its age.
   */
  async findStaleParsing(staleSeconds: number): Promise<Request[]> {
    // Guard the boundary: a non-positive window turns `NOW() - make_interval(secs => -n)` into a
    // future cutoff that would match every parsing row, including ones still actively in flight.
    if (!Number.isFinite(staleSeconds) || staleSeconds <= 0) {
      throw new Error(`findStaleParsing requires staleSeconds > 0, got ${staleSeconds}`);
    }
    return this.requestRepository
      .createQueryBuilder('request')
      .where('request.status = :status', { status: RequestStatus.PARSING })
      .andWhere(
        '(request.processing_started_at < NOW() - make_interval(secs => :secs) OR ' +
          '(request.processing_started_at IS NULL AND ' +
          'request.created_at < NOW() - make_interval(secs => :secs)))',
        { secs: staleSeconds },
      )
      .getMany();
  }
}
