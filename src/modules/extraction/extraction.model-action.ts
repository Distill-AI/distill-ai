import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, type QueryDeepPartialEntity } from 'typeorm';
import * as SYS_MSG from '@constants/system-messages';
import { AbstractModelAction } from '@common/model-action/abstract.model-action';
import { Extraction } from './entities/extraction.entity';

export interface UpsertExtractionParams {
  requestId: string;
  model: string;
  schemaValid: boolean;
  rawJson: Record<string, unknown>;
  reextractCount: number;
  latencyMs: number | null;
}

@Injectable()
export class ExtractionModelAction extends AbstractModelAction<Extraction> {
  constructor(
    @InjectRepository(Extraction)
    repository: Repository<Extraction>,
  ) {
    super(repository, Extraction);
  }

  /** Returns the extraction row for a request, if one exists. */
  async findByRequestId(requestId: string): Promise<Extraction | null> {
    return this.get({
      identifierOptions: { request_id: requestId },
    });
  }

  /** Atomically creates or updates the extraction row keyed by request_id. */
  async upsertForRequest(
    params: UpsertExtractionParams,
    transaction?: EntityManager,
  ): Promise<Extraction> {
    const repo = transaction?.getRepository(Extraction) ?? this.repository;

    await repo.upsert(
      {
        request_id: params.requestId,
        model: params.model,
        schema_valid: params.schemaValid,
        raw_json: params.rawJson as QueryDeepPartialEntity<Extraction>['raw_json'],
        reextract_count: params.reextractCount,
        latency_ms: params.latencyMs,
      },
      { conflictPaths: ['request_id'] },
    );

    const saved = await repo.findOne({ where: { request_id: params.requestId } });
    if (!saved) {
      throw new Error(SYS_MSG.EXTRACTION_UPSERT_FAILED(params.requestId));
    }

    return saved;
  }
}
