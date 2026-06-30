import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { z } from 'zod';
import { AbstractModelAction } from '@common/model-action/abstract.model-action';
import { PricingRule } from './entities/pricing-rule.entity';
import { PricingRuleType } from './enums/pricing-rule-type.enum';
import type { PricingRuleSet, QuantityBreakRule } from './interfaces/pricing.interfaces';

const QtyBreakConfigSchema = z.object({
  min_qty: z.number().int().min(1),
  discount_pct: z.number().min(0).max(100),
});

@Injectable()
export class PricingRuleModelAction extends AbstractModelAction<PricingRule> {
  constructor(
    @InjectRepository(PricingRule)
    repository: Repository<PricingRule>,
  ) {
    super(repository, PricingRule);
  }

  /**
   * Loads the org's active pricing rules under org scope (SEC-02) and projects them into the
   * deterministic rule set the pricing service consumes. A malformed quantity-break config is
   * skipped rather than crashing the price node. `hasAnyRules` is derived from the successfully
   * parsed quantity-break rules - not the raw row count - so an org whose only active rows are
   * malformed or non-quantity-break still fails closed for review (EC-02) instead of pricing at base.
   */
  async getRuleSetForOrg(orgId: string): Promise<PricingRuleSet> {
    const { payload } = await this.find({
      findOptions: { org_id: orgId, active: true },
      transactionOptions: { useTransaction: false },
    });

    const quantityBreaks: QuantityBreakRule[] = [];
    for (const rule of payload) {
      if (rule.rule_type !== PricingRuleType.QTY_BREAK) continue;
      const parsed = QtyBreakConfigSchema.safeParse(rule.config);
      if (parsed.success) {
        quantityBreaks.push({ minQty: parsed.data.min_qty, discountPct: parsed.data.discount_pct });
      }
    }

    return { quantityBreaks, hasAnyRules: quantityBreaks.length > 0 };
  }
}
