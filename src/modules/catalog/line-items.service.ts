import { HttpStatus, Injectable } from '@nestjs/common';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import { LineItemModelAction } from './line-item.model-action';
import { CandidateMatchModelAction } from './candidate-match.model-action';
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
  constructor(
    private readonly lineItemModelAction: LineItemModelAction,
    private readonly candidateMatchModelAction: CandidateMatchModelAction,
  ) {}

  /** Returns ranked candidate matches for a line item, scoped to the caller's org. */
  async getCandidates(lineId: string, callerOrgId?: string): Promise<CandidateResponseItem[]> {
    const lineItem = await this.lineItemModelAction.get({
      identifierOptions: { id: lineId },
      relations: { request: true },
    });

    if (!lineItem) {
      throw new CustomHttpException(SYS_MSG.LINE_ITEM_NOT_FOUND(lineId), HttpStatus.NOT_FOUND);
    }

    if (callerOrgId !== undefined && lineItem.request.org_id !== callerOrgId) {
      throw new CustomHttpException(SYS_MSG.LINE_ITEM_NOT_FOUND(lineId), HttpStatus.NOT_FOUND);
    }

    const { payload: candidates } = await this.candidateMatchModelAction.list({
      filterRecordOptions: { line_item_id: lineId },
      relations: { sku: true },
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
