import type { AxiosError } from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import client from './client';
import { requestKeys } from './requests';

/**
 * Downloads an attachment's original bytes and saves it under its filename (blob fetch + object URL).
 */
export async function downloadAttachment(
  requestId: string,
  attachmentId: string,
  filename: string,
): Promise<void> {
  const res = await client.get<Blob>(`/requests/${requestId}/attachments/${attachmentId}`, {
    responseType: 'blob',
  });

  const url = URL.createObjectURL(res.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

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
