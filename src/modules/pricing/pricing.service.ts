import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as SYS_MSG from '@constants/system-messages';
import * as path from 'node:path';
import { z } from 'zod';
import { env } from '@config/env';
const CONFIG_DIR = path.resolve(process.cwd(), env.RULES_CONFIG_PATH);

// ── Zod schema ──────────────────────────────────────────────────────────────────

const QuantityBreakSchema = z
  .object({
    minQty: z.number().int().min(1),
    maxQty: z.number().int().min(1).optional(),
    discountPercent: z.number().min(0).max(100),
  })
  .refine((qb) => qb.maxQty === undefined || qb.maxQty >= qb.minQty, {
    message: 'maxQty must be greater than or equal to minQty',
    path: ['maxQty'],
  });

const PricingRulesSchema = z.object({
  marginFloor: z.object({
    default: z.number().min(0).max(100),
    byOrg: z.record(z.string(), z.number().min(0).max(100)).optional(),
  }),
  maxDiscount: z.object({
    default: z.number().min(0).max(100),
    byOrg: z.record(z.string(), z.number().min(0).max(100)).optional(),
  }),
  quantityBreaks: z.array(QuantityBreakSchema).min(1),
});
type PricingRulesConfig = z.infer<typeof PricingRulesSchema>;

// ── Interfaces ──────────────────────────────────────────────────────────────────

interface PriceBreach {
  rule: string;
  severity: 'error' | 'warning';
  message: string;
  current: number | string;
  limit?: number;
}

interface PriceEvaluationResult {
  approved: boolean;
  effectiveDiscount: number;
  effectiveMargin: number;
  appliedRules: {
    marginFloor: number;
    maxDiscount: number;
    quantityBreakApplied: number;
  };
  breaches: PriceBreach[];
}

// ── Defaults & helpers ──────────────────────────────────────────────────────────

const DEFAULT_RULES: PricingRulesConfig = {
  marginFloor: { default: 15 },
  maxDiscount: { default: 25 },
  quantityBreaks: [
    { minQty: 1, discountPercent: 0 },
    { minQty: 11, maxQty: 50, discountPercent: 5 },
    { minQty: 51, maxQty: 100, discountPercent: 10 },
    { minQty: 101, discountPercent: 15 },
  ],
};

function resolveConfigPath(overridePath?: string): string {
  if (overridePath) {
    const resolved = path.resolve(overridePath);
    if (!resolved.startsWith(CONFIG_DIR + path.sep)) {
      throw new Error(SYS_MSG.PRICING_CONFIG_PATH_INVALID);
    }
    return resolved;
  }
  return path.join(CONFIG_DIR, 'pricing-rules.json');
}

// ── Service ─────────────────────────────────────────────────────────────────────

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  private cachedConfig: PricingRulesConfig | null = null;
  private lastMtime = 0;
  private configPath = resolveConfigPath();

  async getRules(): Promise<PricingRulesConfig> {
    const resolvedPath = this.configPath;

    try {
      const stat = await fs.stat(resolvedPath);

      if (stat.mtimeMs > this.lastMtime || !this.cachedConfig) {
        const raw = await fs.readFile(resolvedPath, 'utf-8');
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const validated = PricingRulesSchema.parse(parsed);

        this.cachedConfig = validated;
        this.lastMtime = stat.mtimeMs;
        this.logger.log('Pricing rules loaded from config file');
      }

      return this.cachedConfig;
    } catch (err) {
      if (this.cachedConfig) {
        this.logger.warn(
          `Failed to read pricing rules config, using cached: ${(err as Error).message}`,
        );
        return this.cachedConfig;
      }

      this.logger.warn(
        `Failed to read pricing rules config, using defaults: ${(err as Error).message}`,
      );
      return DEFAULT_RULES;
    }
  }

  async reload(overridePath?: string): Promise<PricingRulesConfig> {
    const resolvedPath = overridePath ? resolveConfigPath(overridePath) : this.configPath;

    try {
      const stat = await fs.stat(resolvedPath);
      const raw = await fs.readFile(resolvedPath, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const validated = PricingRulesSchema.parse(parsed);

      this.cachedConfig = validated;
      this.lastMtime = stat.mtimeMs;
      this.configPath = resolvedPath;

      this.logger.log('Pricing rules reloaded from config file');
      return validated;
    } catch (err) {
      this.logger.error(`Failed to reload pricing rules: ${(err as Error).message}`);
      throw err;
    }
  }

  async evaluate(params: {
    orgId: string;
    total: number;
    quantity: number;
    marginPercent: number;
    discountPercent: number;
  }): Promise<PriceEvaluationResult> {
    const rules = await this.getRules();
    const breaches: PriceBreach[] = [];

    const marginFloor = rules.marginFloor.byOrg?.[params.orgId] ?? rules.marginFloor.default;
    const maxDiscount = rules.maxDiscount.byOrg?.[params.orgId] ?? rules.maxDiscount.default;

    if (params.marginPercent < marginFloor) {
      breaches.push({
        rule: 'margin_floor',
        severity: 'error',
        message: `Margin ${params.marginPercent}% is below floor of ${marginFloor}%`,
        current: params.marginPercent,
        limit: marginFloor,
      });
    }

    if (params.discountPercent > maxDiscount) {
      breaches.push({
        rule: 'max_discount',
        severity: 'warning',
        message: `Discount ${params.discountPercent}% exceeds max of ${maxDiscount}%`,
        current: params.discountPercent,
        limit: maxDiscount,
      });
    }

    let effectiveDiscount = params.discountPercent;
    let quantityBreakApplied = 0;

    for (const qb of rules.quantityBreaks) {
      if (params.quantity >= qb.minQty && (!qb.maxQty || params.quantity <= qb.maxQty)) {
        if (qb.discountPercent > quantityBreakApplied) {
          quantityBreakApplied = qb.discountPercent;
        }
      }
    }

    if (quantityBreakApplied > effectiveDiscount) {
      effectiveDiscount = quantityBreakApplied;
    }

    const effectiveMargin = params.marginPercent - (effectiveDiscount - params.discountPercent);

    return {
      approved: breaches.length === 0,
      effectiveDiscount,
      effectiveMargin,
      appliedRules: { marginFloor, maxDiscount, quantityBreakApplied },
      breaches,
    };
  }
}

export type { PricingRulesConfig, PriceEvaluationResult, PriceBreach };
