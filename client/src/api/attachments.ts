import type { AxiosError } from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';
import { requestKeys } from './requests';

export interface PastePayload {
  content: string;
}

export interface PasteResult {
  message: string;
}

type PasteVariables = {
  requestId: string;
  attachmentId: string;
  content: string;
};

export type PasteError = AxiosError<{ message?: string; error?: string }>;

export const attachmentKeys = {
  paste: (requestId: string, attachmentId: string) =>
    ['attachments', requestId, attachmentId, 'paste'] as const,
};

export async function pasteAttachment(
  requestId: string,
  attachmentId: string,
  payload: PastePayload,
): Promise<PasteResult> {
  const res = await client.post<{ data: PasteResult }>(
    `/requests/${requestId}/attachments/${attachmentId}/paste`,
    payload,
  );
  return res.data.data;
}

export function usePasteAttachment() {
  const queryClient = useQueryClient();

  return useMutation<PasteResult, PasteError, PasteVariables>({
    mutationFn: ({ requestId, attachmentId, content }) =>
      pasteAttachment(requestId, attachmentId, { content }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: requestKeys.detail(variables.requestId) });
    },
  });
}
