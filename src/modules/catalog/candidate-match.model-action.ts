import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AbstractModelAction } from '@common/model-action/abstract.model-action';
import { CandidateMatch } from './entities/candidate-match.entity';
import type { CandidateInput } from './interfaces/candidate-match.interfaces';

export type { CandidateInput };

@Injectable()
export class CandidateMatchModelAction extends AbstractModelAction<CandidateMatch> {
  constructor(
    @InjectRepository(CandidateMatch)
    repository: Repository<CandidateMatch>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {
    super(repository, CandidateMatch);
  }

  /** Atomically replaces all candidate matches for a line item (DELETE + bulk INSERT). */
  async replaceForLineItem(
    lineItemId: string,
    candidates: CandidateInput[],
    transaction?: EntityManager,
  ): Promise<void> {
    const replace = async (em: EntityManager): Promise<void> => {
      await em.delete(CandidateMatch, { line_item_id: lineItemId });
      if (candidates.length === 0) return;

      await em.save(
        CandidateMatch,
        candidates.map((c) => ({
          line_item_id: lineItemId,
          sku_id: c.sku_id,
          score: c.score,
          rank: c.rank,
        })),
      );
    };

    if (transaction) {
      await replace(transaction);
      return;
    }

    await this.dataSource.transaction(replace);
  }
}
