import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type QueryDeepPartialEntity } from 'typeorm';
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

  /** Creates or updates the extraction row keyed by request_id. */
  async upsertForRequest(params: UpsertExtractionParams): Promise<Extraction> {
    const existing = await this.findByRequestId(params.requestId);
    const payload: QueryDeepPartialEntity<Extraction> = {
      model: params.model,
      schema_valid: params.schemaValid,
      raw_json: params.rawJson as QueryDeepPartialEntity<Extraction>['raw_json'],
      reextract_count: params.reextractCount,
      latency_ms: params.latencyMs,
    };

    if (existing) {
      const updated = await this.update({
        identifierOptions: { request_id: params.requestId },
        updatePayload: payload,
        transactionOptions: { useTransaction: false },
      });
      return updated as Extraction;
    }

    return this.create({
      createPayload: {
        request_id: params.requestId,
        model: params.model,
        schema_valid: params.schemaValid,
        raw_json: params.rawJson,
        reextract_count: params.reextractCount,
        latency_ms: params.latencyMs,
        loop_steps: [],
      },
      transactionOptions: { useTransaction: false },
    });
  }
}
