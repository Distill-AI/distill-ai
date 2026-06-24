import { useMutation } from '@tanstack/react-query';
import client from './client';

export interface PastePayload {
  content: string;
}

export interface PasteResult {
  message: string;
}

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
  return useMutation({
    mutationFn: ({
      requestId,
      attachmentId,
      content,
    }: {
      requestId: string;
      attachmentId: string;
      content: string;
    }) => pasteAttachment(requestId, attachmentId, { content }),
  });
}
