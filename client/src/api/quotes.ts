import type { AxiosError } from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';
import { requestKeys } from './requests';
import type { QuoteDetail, RequestDetail } from './requests';
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
 * (per PR-review-learnings.md #18) since the specific reason - not priced yet, the quote can't
 * transition, the request itself isn't approvable, or a reverted-to-DRAFT PDF failure - is
 * backend-owned copy, not something the client should re-derive from a status code alone.
 */
export function resolveApproveQuoteError(error: ApproveQuoteError): string {
  const status = error.response?.status;
  const serverMessage = error.response?.data?.message;
  if (status === 409) return serverMessage ?? 'This quote cannot be approved right now.';
  if (status === 424) return serverMessage ?? 'Could not generate the quote PDF. Please try again.';
  return GENERIC_ERROR;
}

/** Approves and generates the quote (idempotent once READY); merges the result into the existing
 * RequestDetail cache so the Quote Output screen re-renders from useRequest without a refetch. */
export function useApproveQuote(requestId: string) {
  const queryClient = useQueryClient();

  return useMutation<ApproveQuoteResponse, ApproveQuoteError>({
    mutationFn: () => approveQuote(requestId),
    onSuccess: (data) => {
      queryClient.setQueryData<RequestDetail>(requestKeys.detail(requestId), (prev) =>
        prev ? { ...prev, quote: data.quote } : prev,
      );
    },
  });
}

export async function downloadQuotePdf(requestId: string): Promise<Blob> {
  const res = await client.get<Blob>(`/requests/${requestId}/quote/pdf`, {
    responseType: 'blob',
  });
  return res.data;
}
