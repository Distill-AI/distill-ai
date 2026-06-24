import client from './client';

/**
 * Downloads an attachment's original bytes and saves it under its filename.
 * Fetches as a blob so the browser keeps the exact stored bytes unchanged, then
 * triggers the save via a temporary object URL.
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
