import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyService } from '../policy.service';
import type { PolicyRulesConfig } from '../policy.service';

const VALID_RULES: PolicyRulesConfig = {
  autoApproveThreshold: 5000,
  maxLineItems: 100,
  restrictedCategories: ['hazardous', 'controlled'],
  rules: [
    {
      name: 'auto_approve_small_orders',
      condition: 'total <= autoApproveThreshold',
      action: 'approve',
      priority: 10,
      active: true,
    },
    {
      name: 'flag_large_orders',
      condition: 'total > 100000',
      action: 'review',
      priority: 20,
      active: true,
    },
  ],
};

describe('PolicyService', () => {
  let service: PolicyService;

  beforeEach(() => {
    service = new PolicyService();
    (service as unknown as { cachedConfig: PolicyRulesConfig | null }).cachedConfig = VALID_RULES;
    (service as unknown as { lastMtime: number }).lastMtime = Infinity;
  });

  // ── AC: Acceptance Criteria ──────────────────────────────────────────────────

  describe('AC-01 — Changing rules affects next evaluation', () => {
    it('detects violation when line items exceed max', async () => {
      const result = await service.evaluate({
        orgId: 'org-1',
        total: 1000,
        lineItems: 150,
        categories: [],
      });
      expect(result.approved).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].rule).toBe('max_line_items');
    });

    it('passes when within limits', async () => {
      const result = await service.evaluate({
        orgId: 'org-1',
        total: 1000,
        lineItems: 50,
        categories: [],
      });
      expect(result.approved).toBe(true);
    });
  });

  describe('AC-02 — Rule change picked up by next evaluation', () => {
    it('uses current cached rules for evaluation', async () => {
      const result = await service.evaluate({
        orgId: 'org-1',
        total: 1000,
        lineItems: 50,
        categories: [],
      });
      expect(result.approved).toBe(true);

      const modifiedRules: PolicyRulesConfig = { ...VALID_RULES, maxLineItems: 10 };
      (service as unknown as { cachedConfig: PolicyRulesConfig | null }).cachedConfig =
        modifiedRules;

      const result2 = await service.evaluate({
        orgId: 'org-1',
        total: 1000,
        lineItems: 50,
        categories: [],
      });
      expect(result2.approved).toBe(false);
      expect(result2.violations[0].rule).toBe('max_line_items');
    });
  });

  // ── FR: Functional Requirements ──────────────────────────────────────────────

  describe('FR — auto-approve threshold', () => {
    it('marks as auto-approvable when total is below threshold', async () => {
      const result = await service.evaluate({
        orgId: 'org-1',
        total: 3000,
        lineItems: 5,
        categories: [],
      });
      expect(result.autoApprovable).toBe(true);
    });

    it('not auto-approvable when total exceeds threshold', async () => {
      const result = await service.evaluate({
        orgId: 'org-1',
        total: 10000,
        lineItems: 5,
        categories: [],
      });
      expect(result.autoApprovable).toBe(false);
    });
  });

  describe('FR — restricted categories', () => {
    it('flags restricted category as violation', async () => {
      const result = await service.evaluate({
        orgId: 'org-1',
        total: 1000,
        lineItems: 5,
        categories: ['hazardous'],
      });
      expect(result.violations.some((v) => v.rule === 'restricted_category')).toBe(true);
      expect(result.approved).toBe(false);
    });

    it('passes non-restricted categories', async () => {
      const result = await service.evaluate({
        orgId: 'org-1',
        total: 1000,
        lineItems: 5,
        categories: ['electronics'],
      });
      expect(result.violations.some((v) => v.rule === 'restricted_category')).toBe(false);
    });
  });

  describe('FR — triggered rules', () => {
    it('reports active rules as triggered', async () => {
      const result = await service.evaluate({
        orgId: 'org-1',
        total: 1000,
        lineItems: 5,
      });
      expect(result.triggeredRules).toContain('auto_approve_small_orders');
      expect(result.triggeredRules).toContain('flag_large_orders');
    });
  });

  // ── EC: Edge Cases ──────────────────────────────────────────────────────────

  describe('EC-01 — Malformed config keeps last-known-good', () => {
    it('returns cached rules when file is missing', async () => {
      const before = await service.getRules();
      expect(before.maxLineItems).toBe(100);

      (service as unknown as { configPath: string }).configPath = './nonexistent/policy-rules.json';
      const after = await service.getRules();
      expect(after.maxLineItems).toBe(100);
    });

    it('returns defaults when no cache exists and file is missing', async () => {
      const fresh = new PolicyService();
      (fresh as unknown as { configPath: string }).configPath = './nonexistent/policy-rules.json';
      const rules = await fresh.getRules();
      expect(rules.autoApproveThreshold).toBe(5000);
      expect(rules.maxLineItems).toBe(100);
      expect(rules.restrictedCategories).toEqual([]);
    });
  });

  describe('EC-02 — Consistent rules within a single evaluation', () => {
    it('caches config at start of evaluate()', async () => {
      const results = await Promise.all([
        service.evaluate({
          orgId: 'org-1',
          total: 1000,
          lineItems: 10,
          categories: [],
        }),
        service.evaluate({
          orgId: 'org-1',
          total: 1000,
          lineItems: 10,
          categories: [],
        }),
      ]);
      expect(results[0].violations).toEqual(results[1].violations);
      expect(results[0].autoApprovable).toEqual(results[1].autoApprovable);
    });
  });

  // ── Deterministic behaviour ──────────────────────────────────────────────────

  describe('deterministic', () => {
    it('identical input produces identical output', async () => {
      const dto = {
        orgId: 'org-1',
        total: 5000,
        lineItems: 25,
        categories: ['electronics'],
      };
      const a = await service.evaluate(dto);
      const b = await service.evaluate(dto);
      expect(a).toEqual(b);
    });
  });
});
