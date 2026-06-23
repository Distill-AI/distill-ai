import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  ) {
    super(repository, LineItem);
  }

  /** Replaces all line items for a request with the extracted set. */
  async replaceForRequest(requestId: string, items: LineItemInput[]): Promise<void> {
    await this.delete({
      identifierOptions: { request_id: requestId },
      transactionOptions: { useTransaction: false },
    });

    for (const item of items) {
      await this.create({
        createPayload: {
          request_id: requestId,
          position: item.position,
          raw_text: item.raw_text,
          quantity: item.quantity,
          unit: item.unit,
          flags: [],
        },
        transactionOptions: { useTransaction: false },
      });
    }
  }
}
