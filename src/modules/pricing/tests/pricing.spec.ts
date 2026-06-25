import { describe, it, expect, beforeEach } from 'vitest';
import { PricingService } from '../pricing.service';
import type { PricingRulesConfig } from '../pricing.service';

const VALID_RULES: PricingRulesConfig = {
  marginFloor: { default: 15, byOrg: { 'org-low': 10 } },
  maxDiscount: { default: 25, byOrg: { 'org-generous': 40 } },
  quantityBreaks: [
    { minQty: 1, discountPercent: 0 },
    { minQty: 11, maxQty: 50, discountPercent: 5 },
    { minQty: 51, maxQty: 100, discountPercent: 10 },
    { minQty: 101, discountPercent: 15 },
  ],
};

describe('PricingService', () => {
  let service: PricingService;

  beforeEach(() => {
    service = new PricingService();
    (service as unknown as { cachedConfig: PricingRulesConfig | null }).cachedConfig = VALID_RULES;
    (service as unknown as { lastMtime: number }).lastMtime = Infinity;
  });

  // ── AC: Acceptance Criteria ──────────────────────────────────────────────────

  describe('AC-01 — Changing margin floor affects next quote', () => {
    it('detects breach when margin is below floor', async () => {
      const result = await service.evaluate({
        orgId: 'org-1',
        total: 1000,
        quantity: 10,
        marginPercent: 10,
        discountPercent: 5,
      });
      expect(result.approved).toBe(false);
      expect(result.breaches).toHaveLength(1);
      expect(result.breaches[0].rule).toBe('margin_floor');
      expect(result.breaches[0].current).toBe(10);
      expect(result.breaches[0].limit).toBe(15);
    });

    it('passes when margin meets floor', async () => {
      const result = await service.evaluate({
        orgId: 'org-1',
        total: 1000,
        quantity: 10,
        marginPercent: 15,
        discountPercent: 5,
      });
      expect(result.approved).toBe(true);
      expect(result.breaches).toHaveLength(0);
    });

    it('uses per-org override when present', async () => {
      const result = await service.evaluate({
        orgId: 'org-low',
        total: 1000,
        quantity: 10,
        marginPercent: 10,
        discountPercent: 5,
      });
      expect(result.approved).toBe(true);
    });
  });

  describe('AC-02 — Rule change picked up by next evaluation', () => {
    it('evaluates with current cached rules', async () => {
      const result = await service.evaluate({
        orgId: 'org-1',
        total: 1000,
        quantity: 10,
        marginPercent: 10,
        discountPercent: 5,
      });
      expect(result.appliedRules.marginFloor).toBe(15);
    });

    it('evaluates with updated rules after cache change', async () => {
      const modifiedRules: PricingRulesConfig = {
        ...VALID_RULES,
        marginFloor: { default: 20 },
      };
      (service as unknown as { cachedConfig: PricingRulesConfig | null }).cachedConfig =
        modifiedRules;

      const result = await service.evaluate({
        orgId: 'org-1',
        total: 1000,
        quantity: 10,
        marginPercent: 18,
        discountPercent: 5,
      });
      expect(result.approved).toBe(false);
      expect(result.breaches[0].rule).toBe('margin_floor');
    });
  });

  // ── Functional requirements ──────────────────────────────────────────────────

  describe('FR-1 — margin floor evaluation', () => {
    it('flags margin-floor breach unconditionally regardless of other fields', async () => {
      const result = await service.evaluate({
        orgId: 'org-1',
        total: 999999,
        quantity: 1,
        marginPercent: 5,
        discountPercent: 0,
      });
      expect(result.breaches.some((b) => b.rule === 'margin_floor')).toBe(true);
    });
  });

  describe('FR — max discount evaluation', () => {
    it('flags breach when discount exceeds max', async () => {
      const result = await service.evaluate({
        orgId: 'org-1',
        total: 1000,
        quantity: 1,
        marginPercent: 30,
        discountPercent: 50,
      });
      expect(result.breaches.some((b) => b.rule === 'max_discount')).toBe(true);
    });

    it('uses per-org max discount override', async () => {
      const result = await service.evaluate({
        orgId: 'org-generous',
        total: 1000,
        quantity: 1,
        marginPercent: 30,
        discountPercent: 35,
      });
      expect(result.breaches.some((b) => b.rule === 'max_discount')).toBe(false);
    });
  });

  describe('FR — quantity breaks', () => {
    it('applies no discount break for small quantities', async () => {
      const result = await service.evaluate({
        orgId: 'org-1',
        total: 1000,
        quantity: 1,
        marginPercent: 30,
        discountPercent: 0,
      });
      expect(result.appliedRules.quantityBreakApplied).toBe(0);
      expect(result.effectiveDiscount).toBe(0);
    });

    it('applies 10% quantity break at qty 75', async () => {
      const result = await service.evaluate({
        orgId: 'org-1',
        total: 1000,
        quantity: 75,
        marginPercent: 30,
        discountPercent: 0,
      });
      expect(result.appliedRules.quantityBreakApplied).toBe(10);
      expect(result.effectiveDiscount).toBe(10);
    });

    it('uses whichever is larger: discount or quantity break', async () => {
      const result = await service.evaluate({
        orgId: 'org-1',
        total: 1000,
        quantity: 75,
        marginPercent: 30,
        discountPercent: 8,
      });
      expect(result.effectiveDiscount).toBe(10);
    });
  });

  // ── EC: Edge Cases ──────────────────────────────────────────────────────────

  describe('EC-01 — Malformed config keeps last-known-good', () => {
    it('returns cached rules when reload fails', async () => {
      const before = await service.getRules();
      expect(before.marginFloor.default).toBe(15);

      (service as unknown as { configPath: string }).configPath =
        './nonexistent/pricing-rules.json';
      const after = await service.getRules();
      expect(after.marginFloor.default).toBe(15);
    });

    it('returns defaults when no cache exists and file is missing', async () => {
      const fresh = new PricingService();
      (fresh as unknown as { configPath: string }).configPath = './nonexistent/pricing-rules.json';
      const rules = await fresh.getRules();
      expect(rules.marginFloor.default).toBe(15);
      expect(rules.maxDiscount.default).toBe(25);
      expect(rules.quantityBreaks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('EC-02 — Consistent rules within a single evaluation', () => {
    it('captures a snapshot at the start of evaluate()', async () => {
      const results = await Promise.all([
        service.evaluate({
          orgId: 'org-1',
          total: 1000,
          quantity: 10,
          marginPercent: 10,
          discountPercent: 5,
        }),
        service.evaluate({
          orgId: 'org-1',
          total: 1000,
          quantity: 10,
          marginPercent: 10,
          discountPercent: 5,
        }),
      ]);
      expect(results[0].appliedRules).toEqual(results[1].appliedRules);
      expect(results[0].breaches).toEqual(results[1].breaches);
    });
  });

  // ── D0 — Deterministic behaviour ────────────────────────────────────────────

  describe('deterministic', () => {
    it('identical input produces identical output', async () => {
      const dto = {
        orgId: 'org-1',
        total: 5000,
        quantity: 60,
        marginPercent: 20,
        discountPercent: 10,
      };
      const a = await service.evaluate(dto);
      const b = await service.evaluate(dto);
      expect(a).toEqual(b);
    });

    it('margin-floor breach is flagged unconditionally regardless of other fields', async () => {
      const result = await service.evaluate({
        orgId: 'org-1',
        total: 100,
        quantity: 1,
        marginPercent: 14,
        discountPercent: 0,
      });
      expect(result.breaches.some((b) => b.rule === 'margin_floor')).toBe(true);
    });
  });
});
