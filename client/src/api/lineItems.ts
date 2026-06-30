import type { AxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from './client';
import { requestKeys } from './requests';

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

/** Applies a re-map; on success invalidates the request detail so the workspace reconciles (EC-03). */
export function useRemapLineItem(requestId: string) {
  const queryClient = useQueryClient();
  return useMutation<RemapResult, AxiosError, { lineId: string; payload: RemapPayload }>({
    mutationFn: ({ lineId, payload }) => remapLineItem(requestId, lineId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: requestKeys.detail(requestId) });
    },
  });
}
