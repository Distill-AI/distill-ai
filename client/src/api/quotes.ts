import type { AxiosError } from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';
import { requestKeys } from './requests';
import type { QuoteDetail } from './requests';
import { GENERIC_ERROR } from '../lib/errorMessages';

export interface ApproveQuoteResponse {
  quote: QuoteDetail;
}

export async function approveQuote(requestId: string): Promise<ApproveQuoteResponse> {
  const res = await client.post<{ data: ApproveQuoteResponse }>(`/requests/${requestId}/quote`);
  return res.data.data;
}

export type ApproveQuoteError = AxiosError<{ message?: string }>;

/**
 * Maps an approve-quote failure to display copy. Prefers the server's own message for 409/424
 * since the specific reason - not priced yet, the quote can't transition, the request itself
 * isn't approvable, or a reverted-to-DRAFT PDF failure - is backend-owned copy, not something
 * the client should re-derive from a status code alone.
 */
export function resolveApproveQuoteError(error: ApproveQuoteError): string {
  const status = error.response?.status;
  const serverMessage = error.response?.data?.message;
  if (status === 409) return serverMessage ?? 'This quote cannot be approved right now.';
  if (status === 424) return serverMessage ?? 'Could not generate the quote PDF. Please try again.';
  if (status && status >= 400 && status < 500) return serverMessage ?? GENERIC_ERROR;
  return GENERIC_ERROR;
}

/** Approves and generates the quote (idempotent once READY); invalidates the request detail and
 * list caches so the Quote Output, Review, and Inbox screens all reflect the new approved status. */
export function useApproveQuote(requestId: string) {
  const queryClient = useQueryClient();

  return useMutation<ApproveQuoteResponse, ApproveQuoteError>({
    mutationFn: () => approveQuote(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: requestKeys.detail(requestId) });
      queryClient.invalidateQueries({ queryKey: requestKeys.lists() });
    },
  });
}

export async function downloadQuotePdf(requestId: string): Promise<Blob> {
  const res = await client.get<Blob>(`/requests/${requestId}/quote/pdf`, {
    responseType: 'blob',
  });
  return res.data;
}
