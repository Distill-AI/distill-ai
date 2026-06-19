import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { AbstractModelAction } from '@common/model-action/abstract.model-action';
import { Request } from './entities/request.entity';
import { CurrentNode } from './enums/current-node.enum';
import { RequestStatus } from './enums/request-status.enum';

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

  /** Set the working/terminal status of a request. */
  async setStatus(requestId: string, status: RequestStatus): Promise<void> {
    await this.requestRepository.update({ id: requestId }, { status });
  }

  /**
   * Requests stuck in 'parsing' whose processing started more than `staleSeconds` ago.
   * Backs the RecoverySweep; matches the `(status, processing_started_at) WHERE status='parsing'`
   * partial index.
   */
  async findStaleParsing(staleSeconds: number): Promise<Request[]> {
    const cutoff = new Date(Date.now() - staleSeconds * 1000);
    return this.requestRepository.find({
      where: {
        status: RequestStatus.PARSING,
        processing_started_at: LessThan(cutoff),
      },
    });
  }
}
