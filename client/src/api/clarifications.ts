import type { AxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from './client';
import type { Clarification, UpdateDraftPayload, SendResult } from './interface/clarification';

export const clarificationKeys = {
  all: () => ['clarifications'] as const,
  byRequest: (requestId: string) => [...clarificationKeys.all(), 'request', requestId] as const,
};

export async function fetchClarification(requestId: string): Promise<Clarification> {
  const res = await client.get<{ data: Clarification }>(`/requests/${requestId}/clarifications`);
  return res.data.data;
}

export function useClarification(requestId: string | undefined) {
  return useQuery({
    queryKey: clarificationKeys.byRequest(requestId ?? ''),
    queryFn: () => fetchClarification(requestId as string),
    enabled: Boolean(requestId),
  });
}

export async function updateDraft(
  clarificationId: string,
  payload: UpdateDraftPayload,
): Promise<Clarification> {
  const res = await client.put<{ data: Clarification }>(
    `/clarifications/${clarificationId}/draft`,
    payload,
  );
  return res.data.data;
}

export function useUpdateDraft() {
  const queryClient = useQueryClient();

  return useMutation<
    Clarification,
    AxiosError,
    { clarificationId: string; payload: UpdateDraftPayload }
  >({
    mutationFn: ({ clarificationId, payload }) => updateDraft(clarificationId, payload),
    onSuccess: (data) => {
      queryClient.setQueryData<Clarification>(clarificationKeys.byRequest(data.request_id), data);
    },
  });
}

export async function sendClarification(clarificationId: string): Promise<SendResult> {
  const res = await client.post<{ data: SendResult }>(`/clarifications/${clarificationId}/send`);
  return res.data.data;
}

export function useSendClarification() {
  const queryClient = useQueryClient();

  return useMutation<SendResult, AxiosError, { clarificationId: string; requestId: string }>({
    mutationFn: ({ clarificationId }) => sendClarification(clarificationId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: clarificationKeys.byRequest(variables.requestId) });
    },
  });
}
