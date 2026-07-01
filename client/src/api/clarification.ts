import type { AxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from './client';

export const clarificationKeys = {
  all: () => ['clarifications'] as const,
  byRequest: (requestId: string) => [...clarificationKeys.all(), 'request', requestId] as const,
};

// Mirror of src/modules/clarification/entities/clarification.entity.ts (source of truth);
// keep field names in sync.
export interface Clarification {
  id: string;
  request_id: string;
  gaps: string[];
  draft_subject: string | null;
  draft_body: string | null;
  sent_at: string | null;
}

export async function fetchClarification(requestId: string): Promise<Clarification> {
  const res = await client.get<{ data: Clarification }>(`/requests/${requestId}/clarifications`);
  return res.data.data;
}

/** Loads the clarification for a request, if one has been drafted yet. A 404 means none exists. */
export function useClarification(requestId: string | undefined) {
  return useQuery({
    queryKey: clarificationKeys.byRequest(requestId ?? ''),
    queryFn: () => fetchClarification(requestId as string),
    enabled: Boolean(requestId),
    retry: false,
  });
}

interface GenerateClarificationDraftPayload {
  requestId: string;
  gaps: string[];
}

export async function generateClarificationDraft(
  payload: GenerateClarificationDraftPayload,
): Promise<Clarification> {
  const res = await client.post<{ data: Clarification }>(
    `/requests/${payload.requestId}/clarifications/draft`,
    { gaps: payload.gaps },
  );
  return res.data.data;
}

/** Generates (or regenerates, if one already exists and isn't sent) the clarification draft. */
export function useGenerateClarificationDraft() {
  const queryClient = useQueryClient();

  return useMutation<
    Clarification,
    AxiosError<{ message?: string }>,
    GenerateClarificationDraftPayload
  >({
    mutationFn: generateClarificationDraft,
    onSuccess: (data, variables) => {
      queryClient.setQueryData<Clarification>(
        clarificationKeys.byRequest(variables.requestId),
        data,
      );
    },
  });
}

interface UpdateClarificationDraftPayload {
  id: string;
  draft_subject?: string;
  draft_body?: string;
}

export async function updateClarificationDraft(
  payload: UpdateClarificationDraftPayload,
): Promise<Clarification> {
  const { id, ...body } = payload;
  const res = await client.put<{ data: Clarification }>(`/clarifications/${id}/draft`, body);
  return res.data.data;
}

/** Saves edits to the clarification draft's subject and/or body. */
export function useUpdateClarificationDraft() {
  const queryClient = useQueryClient();

  return useMutation<
    Clarification,
    AxiosError<{ message?: string }>,
    UpdateClarificationDraftPayload
  >({
    mutationFn: updateClarificationDraft,
    onSuccess: (data) => {
      queryClient.setQueryData<Clarification>(clarificationKeys.byRequest(data.request_id), data);
    },
  });
}

export async function sendClarification(id: string): Promise<Clarification> {
  const res = await client.post<{ data: Clarification }>(`/clarifications/${id}/send`);
  return res.data.data;
}

/** Marks the clarification as sent (idempotent: no-ops if already sent). */
export function useSendClarification() {
  const queryClient = useQueryClient();

  return useMutation<Clarification, AxiosError<{ message?: string }>, string>({
    mutationFn: sendClarification,
    onSuccess: (data) => {
      queryClient.setQueryData<Clarification>(clarificationKeys.byRequest(data.request_id), data);
    },
  });
}
