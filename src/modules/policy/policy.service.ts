import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod';
import { env } from '@config/env';

// ── Zod schema ──────────────────────────────────────────────────────────────────

const PolicyRuleSchema = z.object({
  name: z.string().min(1),
  condition: z.string().min(1),
  action: z.string().min(1),
  priority: z.number().int().min(1).default(1),
  active: z.boolean().default(true),
});

const PolicyRulesSchema = z.object({
  autoApproveThreshold: z.number().min(0).default(5000),
  maxLineItems: z.number().int().min(1).default(100),
  restrictedCategories: z.array(z.string()).default([]),
  rules: z.array(PolicyRuleSchema).default([]),
});

type PolicyRulesConfig = z.infer<typeof PolicyRulesSchema>;

// ── Interfaces ──────────────────────────────────────────────────────────────────

interface PolicyViolation {
  rule: string;
  severity: 'error' | 'warning';
  message: string;
  current: number | string;
  limit?: number;
}

interface PolicyEvaluationResult {
  approved: boolean;
  autoApprovable: boolean;
  triggeredRules: string[];
  violations: PolicyViolation[];
}

// ── Defaults & helpers ──────────────────────────────────────────────────────────

const DEFAULT_RULES: PolicyRulesConfig = {
  autoApproveThreshold: 5000,
  maxLineItems: 100,
  restrictedCategories: [],
  rules: [],
};

function resolveConfigPath(overridePath?: string): string {
  if (overridePath) return path.resolve(overridePath);
  return path.resolve(process.cwd(), env.RULES_CONFIG_PATH, 'policy-rules.json');
}

// ── Service ─────────────────────────────────────────────────────────────────────

@Injectable()
export class PolicyService {
  private readonly logger = new Logger(PolicyService.name);

  private cachedConfig: PolicyRulesConfig | null = null;
  private lastMtime = 0;
  private configPath = resolveConfigPath();

  async getRules(): Promise<PolicyRulesConfig> {
    const resolvedPath = this.configPath;

    try {
      const stat = await fs.stat(resolvedPath);

      if (stat.mtimeMs > this.lastMtime || !this.cachedConfig) {
        const raw = await fs.readFile(resolvedPath, 'utf-8');
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const validated = PolicyRulesSchema.parse(parsed);

        this.cachedConfig = validated;
        this.lastMtime = stat.mtimeMs;
        this.logger.log('Policy rules loaded from config file');
      }

      return this.cachedConfig;
    } catch (err) {
      if (this.cachedConfig) {
        this.logger.warn(
          `Failed to read policy rules config, using cached: ${(err as Error).message}`,
        );
        return this.cachedConfig;
      }

      this.logger.warn(
        `Failed to read policy rules config, using defaults: ${(err as Error).message}`,
      );
      return DEFAULT_RULES;
    }
  }

  async reload(overridePath?: string): Promise<PolicyRulesConfig> {
    const resolvedPath = overridePath ? resolveConfigPath(overridePath) : this.configPath;

    try {
      const stat = await fs.stat(resolvedPath);
      const raw = await fs.readFile(resolvedPath, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const validated = PolicyRulesSchema.parse(parsed);

      this.cachedConfig = validated;
      this.lastMtime = stat.mtimeMs;
      this.configPath = resolvedPath;

      this.logger.log('Policy rules reloaded from config file');
      return validated;
    } catch (err) {
      this.logger.error(`Failed to reload policy rules: ${(err as Error).message}`);
      throw err;
    }
  }

  async evaluate(params: {
    orgId: string;
    total: number;
    lineItems: number;
    categories?: string[];
  }): Promise<PolicyEvaluationResult> {
    const rules = await this.getRules();
    const violations: PolicyViolation[] = [];

    if (params.lineItems > rules.maxLineItems) {
      violations.push({
        rule: 'max_line_items',
        severity: 'error',
        message: `Line items ${params.lineItems} exceeds max of ${rules.maxLineItems}`,
        current: params.lineItems,
        limit: rules.maxLineItems,
      });
    }

    for (const category of params.categories ?? []) {
      if (rules.restrictedCategories.includes(category)) {
        violations.push({
          rule: 'restricted_category',
          severity: 'error',
          message: `Category "${category}" is restricted`,
          current: category,
        });
      }
    }

    const autoApprovable = params.total <= rules.autoApproveThreshold;

    const triggeredRules: string[] = [];
    for (const rule of rules.rules) {
      if (!rule.active) continue;
      triggeredRules.push(rule.name);
    }

    return {
      approved: violations.length === 0,
      autoApprovable,
      triggeredRules,
      violations,
    };
  }
}

export type { PolicyRulesConfig, PolicyEvaluationResult, PolicyViolation };
