import type { AxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from './client';
import { requestKeys, type RequestDetail } from './requests';

/** A ranked candidate match for a line item (GET /line-items/:id/candidates, US-E3-4). */
export interface Candidate {
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

export async function fetchCandidates(lineId: string): Promise<Candidate[]> {
  const res = await client.get<{ data: Candidate[] }>(`/line-items/${lineId}/candidates`);
  return res.data.data;
}

/** Loads the ranked candidates for a line; disabled until a line is selected. */
export function useCandidates(lineId: string | null) {
  return useQuery({
    queryKey: ['line-items', lineId, 'candidates'],
    queryFn: () => fetchCandidates(lineId as string),
    enabled: Boolean(lineId),
  });
}

export interface RemapPayload {
  sku_id?: string;
  quantity?: number;
  unit_price_minor?: number;
  override?: boolean;
}

export interface RemapResult {
  request_id: string;
  line: {
    id: string;
    matched_sku_id: string | null;
    quantity: number | null;
    unit_price_minor: number | null;
    match_confidence: number | null;
  };
  quote: {
    quote_id: string | null;
    subtotal_minor: number;
    discount_minor: number;
    total_minor: number;
    lead_time_days: number | null;
    blocked: boolean;
  };
}

export async function remapLineItem(
  requestId: string,
  lineId: string,
  payload: RemapPayload,
): Promise<RemapResult> {
  const res = await client.patch<{ data: RemapResult }>(
    `/requests/${requestId}/line-items/${lineId}`,
    payload,
  );
  return res.data.data;
}

/** Variables for a re-map. `optimisticUnitPriceMinor` (the picked SKU's price) lets the total move
 * before the server responds; it is a presentational estimate only, reconciled on response (SEC-01). */
export interface RemapVariables {
  lineId: string;
  payload: RemapPayload;
  optimisticUnitPriceMinor?: number;
}

interface RemapContext {
  previous?: RequestDetail;
  seq: number;
}

/**
 * Returns the detail with an optimistic running total for a line re-mapped to `newUnitPriceMinor`
 * (US-E6-3 FR-1). The re-mapped line is found by id -> position (quote lines carry position, not the
 * line-item id). Discount is held at its current value; the server reconciles the real figure on
 * response (EC-01). Returns `undefined` when there is nothing to estimate against.
 */
function withOptimisticTotal(
  detail: RequestDetail,
  lineId: string,
  newUnitPriceMinor: number,
): RequestDetail | undefined {
  const quote = detail.quote;
  if (!quote) return undefined;
  const lineItem = detail.line_items.find((li) => li.id === lineId);
  if (!lineItem) return undefined;
  const quoteLine = quote.lines.find((ql) => ql.position === lineItem.position);
  if (!quoteLine) return undefined;

  const newAmount = quoteLine.quantity * newUnitPriceMinor;
  const subtotal = quote.subtotal_minor - quoteLine.amount_minor + newAmount;
  return {
    ...detail,
    quote: {
      ...quote,
      subtotal_minor: subtotal,
      total_minor: subtotal - quote.discount_minor,
      lines: quote.lines.map((ql) =>
        ql.position === lineItem.position
          ? { ...ql, unit_price_minor: newUnitPriceMinor, amount_minor: newAmount }
          : ql,
      ),
    },
  };
}

/** Overwrites the cached quote totals with the server-confirmed figures from the PATCH response. */
function reconcileTotals(detail: RequestDetail, quote: RemapResult['quote']): RequestDetail {
  if (!detail.quote) return detail;
  return {
    ...detail,
    quote: {
      ...detail.quote,
      subtotal_minor: quote.subtotal_minor,
      discount_minor: quote.discount_minor,
      total_minor: quote.total_minor,
      lead_time_days: quote.lead_time_days,
    },
  };
}

/**
 * Applies a re-map with an instant, reconciled running total (US-E6-3). `onMutate` writes an
 * optimistic total (FR-1); the PATCH response overwrites it with the authoritative figures (FR-2,
 * no flicker); a failure rolls back to the pre-mutation snapshot (EC-03); and a monotonic sequence
 * makes rapid re-maps last-write-wins so a late, out-of-order response can't restore a stale total
 * (EC-02). A background invalidate then refreshes the quote lines (the response carries totals only).
 */
// Latest issued re-map sequence per request id. Module-scoped, not a hook ref, so it survives the
// RemapDrawer unmount/remount between opens: only the most-recently-issued re-map for a request may
// write to the quote cache, so an earlier PATCH that resolves while a newer one is still in flight
// (or after the drawer reopened) can't clobber the newer optimistic/reconciled total (US-E6-3 EC-02).
const remapSeqByRequest = new Map<string, number>();

export function useRemapLineItem(requestId: string) {
  const queryClient = useQueryClient();
  const detailKey = requestKeys.detail(requestId);
  const isCurrent = (ctx: RemapContext | undefined): boolean =>
    ctx != null && ctx.seq === remapSeqByRequest.get(requestId);

  return useMutation<RemapResult, AxiosError, RemapVariables, RemapContext>({
    mutationFn: ({ lineId, payload }) => remapLineItem(requestId, lineId, payload),
    onMutate: async ({ lineId, optimisticUnitPriceMinor }) => {
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previous = queryClient.getQueryData<RequestDetail>(detailKey);
      const seq = (remapSeqByRequest.get(requestId) ?? 0) + 1;
      remapSeqByRequest.set(requestId, seq);
      if (previous && optimisticUnitPriceMinor !== undefined) {
        const optimistic = withOptimisticTotal(previous, lineId, optimisticUnitPriceMinor);
        if (optimistic) queryClient.setQueryData(detailKey, optimistic);
      }
      return { previous, seq };
    },
    onError: (_error, _vars, ctx) => {
      // Only the latest issued re-map may touch the cache; an older/superseded one failing must not
      // roll a newer in-flight re-map's optimistic total back (EC-02 / EC-03).
      if (!isCurrent(ctx)) return;
      if (ctx?.previous) queryClient.setQueryData(detailKey, ctx.previous);
    },
    onSuccess: (data, _vars, ctx) => {
      // Ignore a response from any re-map that a newer one has already superseded, even if the newer
      // one is still in flight — otherwise its stale total clobbers the newer optimistic value (EC-02).
      if (!isCurrent(ctx)) return;
      queryClient.setQueryData<RequestDetail>(detailKey, (current) =>
        current ? reconcileTotals(current, data.quote) : current,
      );
    },
    onSettled: (_data, _error, _vars, ctx) => {
      // Refresh the quote lines (the response carries totals only); the refetch total matches the
      // reconciled one, so no flicker. Only the latest re-map triggers it.
      if (isCurrent(ctx)) queryClient.invalidateQueries({ queryKey: detailKey });
    },
  });
}
