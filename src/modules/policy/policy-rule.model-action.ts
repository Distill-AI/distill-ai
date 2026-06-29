import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { z } from 'zod';
import { AbstractModelAction } from '@common/model-action/abstract.model-action';
import { PricingRule } from '@modules/pricing/entities/pricing-rule.entity';
import { PricingRuleType } from '@modules/pricing/enums/pricing-rule-type.enum';
import type { PolicyRuleSet } from './interfaces/policy.interfaces';

const MarginFloorConfigSchema = z.object({ min_margin_pct: z.number().min(0).max(100) });
const MaxDiscountConfigSchema = z.object({ max_discount_pct: z.number().min(0).max(100) });

@Injectable()
export class PolicyRuleModelAction extends AbstractModelAction<PricingRule> {
  constructor(
    @InjectRepository(PricingRule)
    repository: Repository<PricingRule>,
  ) {
    super(repository, PricingRule);
  }

  /**
   * Loads the org's active margin-floor and max-discount thresholds from the org-scoped
   * pricing_rules table (SEC-02). `hasAnyRules` is derived from the parsed thresholds, not the raw
   * row count, so an org whose only active rows are quantity-break (or malformed) policy rows still
   * fails closed (EC-02) instead of passing every quote with no policy evaluation at all.
   *
   * Duplicate active rows of the same type are collapsed deterministically to the most restrictive
   * value - the highest margin floor and the lowest discount cap - so the outcome never depends on
   * row order and identical quotes cannot flip between pass and review.
   */
  async getRuleSetForOrg(orgId: string): Promise<PolicyRuleSet> {
    const { payload } = await this.find({
      findOptions: { org_id: orgId, active: true },
      transactionOptions: { useTransaction: false },
    });

    const marginFloors: number[] = [];
    const maxDiscounts: number[] = [];

    for (const rule of payload) {
      if (rule.rule_type === PricingRuleType.MARGIN_FLOOR) {
        const parsed = MarginFloorConfigSchema.safeParse(rule.config);
        if (parsed.success) marginFloors.push(parsed.data.min_margin_pct);
      } else if (rule.rule_type === PricingRuleType.MAX_DISCOUNT) {
        const parsed = MaxDiscountConfigSchema.safeParse(rule.config);
        if (parsed.success) maxDiscounts.push(parsed.data.max_discount_pct);
      }
    }

    const marginFloorPct = marginFloors.length > 0 ? Math.max(...marginFloors) : null;
    const maxDiscountPct = maxDiscounts.length > 0 ? Math.min(...maxDiscounts) : null;

    return {
      marginFloorPct,
      maxDiscountPct,
      hasAnyRules: marginFloorPct !== null || maxDiscountPct !== null,
    };
  }
}
