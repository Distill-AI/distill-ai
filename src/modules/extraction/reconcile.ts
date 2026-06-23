import type { ExtractionV1 } from './schemas/extraction-v1.schema';

const QUANTITY_TOLERANCE = 0.01;

export type ReconcileResult = { ok: true } | { ok: false; reason: string };

/**
 * Deterministic field and totals check before accepting an LLM extraction.
 * Fails only when source text clearly states a count or total that does not match.
 */
export function reconcile(data: ExtractionV1, sourceText: string): ReconcileResult {
  for (const item of data.line_items) {
    if (!item.unit.trim()) {
      return {
        ok: false,
        reason: `Line item ${item.position} is missing a unit`,
      };
    }
  }

  const statedItemCount = parseStatedItemCount(sourceText);
  if (statedItemCount !== null && data.line_items.length !== statedItemCount) {
    return {
      ok: false,
      reason: `Source states ${statedItemCount} items but extraction has ${data.line_items.length}`,
    };
  }

  const statedTotalQty = parseStatedTotalQuantity(sourceText);
  if (statedTotalQty !== null) {
    const extractedTotal = data.line_items.reduce((sum, item) => sum + item.quantity, 0);
    if (!Number.isFinite(extractedTotal)) {
      return { ok: false, reason: 'Extracted line item quantities are not finite' };
    }
    if (Math.abs(extractedTotal - statedTotalQty) > QUANTITY_TOLERANCE) {
      return {
        ok: false,
        reason: `Source total quantity ${statedTotalQty} does not match extracted sum ${extractedTotal}`,
      };
    }
  }

  return { ok: true };
}

function parseStatedItemCount(sourceText: string): number | null {
  const patterns = [
    /\b(\d+)\s+line\s+items?\b/i,
    /\btotal\s+(?:of\s+)?(\d+)\s+items?\b/i,
    /\b(\d+)\s+items?\s+total\b/i,
  ];

  for (const pattern of patterns) {
    const match = sourceText.match(pattern);
    if (match?.[1]) {
      const count = Number.parseInt(match[1], 10);
      if (Number.isFinite(count) && count > 0) {
        return count;
      }
    }
  }

  return null;
}

function parseStatedTotalQuantity(sourceText: string): number | null {
  const patterns = [
    /\btotal\s+(?:qty|quantity)[:\s]+(\d+(?:\.\d+)?)\b/i,
    /\btotal\s+(?:units|pieces)[:\s]+(\d+(?:\.\d+)?)\b/i,
    /\bgrand\s+total[:\s]+(\d+(?:\.\d+)?)\s+(?:units|pcs|pieces)\b/i,
  ];

  for (const pattern of patterns) {
    const match = sourceText.match(pattern);
    if (match?.[1]) {
      const total = Number.parseFloat(match[1]);
      if (Number.isFinite(total) && total > 0) {
        return total;
      }
    }
  }

  return null;
}
