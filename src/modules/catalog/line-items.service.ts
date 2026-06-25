import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import { LineItem } from './entities/line-item.entity';
import { CandidateMatch } from './entities/candidate-match.entity';
import * as SYS_MSG from '@constants/system-messages';

export interface CandidateResponseItem {
  rank: number;
  confidence: number;
  sku_id: string;
  sku_code: string;
  name: string;
  description: string | null;
  base_price_minor: number;
  currency: string;
  lead_time_days: number | null;
}

@Injectable()
export class LineItemsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Returns ranked candidate matches for a line item, scoped to the caller's org. */
  async getCandidates(lineId: string, callerOrgId?: string): Promise<CandidateResponseItem[]> {
    const lineItem = await this.dataSource.manager.findOne(LineItem, {
      where: { id: lineId },
      relations: ['request'],
    });

    if (!lineItem) {
      throw new CustomHttpException(SYS_MSG.LINE_ITEM_NOT_FOUND(lineId), HttpStatus.NOT_FOUND);
    }

    if (callerOrgId !== undefined && lineItem.request.org_id !== callerOrgId) {
      throw new CustomHttpException(SYS_MSG.LINE_ITEM_NOT_FOUND(lineId), HttpStatus.NOT_FOUND);
    }

    const candidates = await this.dataSource.manager.find(CandidateMatch, {
      where: { line_item_id: lineId },
      relations: ['sku'],
      order: { rank: 'ASC' },
    });

    return candidates.map((c) => ({
      rank: c.rank,
      confidence: c.score,
      sku_id: c.sku_id,
      sku_code: c.sku.sku_code,
      name: c.sku.name,
      description: c.sku.description,
      base_price_minor: c.sku.base_price_minor,
      currency: c.sku.currency,
      lead_time_days: c.sku.lead_time_days,
    }));
  }
}
