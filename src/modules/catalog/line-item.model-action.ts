import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AbstractModelAction } from '@common/model-action/abstract.model-action';
import { LineItem } from './entities/line-item.entity';

export interface LineItemInput {
  position: number;
  raw_text: string;
  quantity: number;
  unit: string;
}

@Injectable()
export class LineItemModelAction extends AbstractModelAction<LineItem> {
  constructor(
    @InjectRepository(LineItem)
    repository: Repository<LineItem>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {
    super(repository, LineItem);
  }

  /** Replaces all line items for a request with the extracted set inside a transaction. */
  async replaceForRequest(
    requestId: string,
    items: LineItemInput[],
    transaction?: EntityManager,
  ): Promise<void> {
    const replace = async (em: EntityManager): Promise<void> => {
      await em.delete(LineItem, { request_id: requestId });
      if (items.length === 0) {
        return;
      }

      await em.save(
        LineItem,
        items.map((item) => ({
          request_id: requestId,
          position: item.position,
          raw_text: item.raw_text,
          quantity: item.quantity,
          unit: item.unit,
          flags: [],
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
