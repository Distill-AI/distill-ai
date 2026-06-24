import type { AxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import client from './client';
import { resolveServerError } from '../lib/errorMessages';

export const requestKeys = {
  all: () => ['requests'] as const,
  lists: () => [...requestKeys.all(), 'list'] as const,
  detail: (id: string) => [...requestKeys.all(), 'detail', id] as const,
};

// Mirror of the server read model in src/modules/requests/interfaces/request-response.interface.ts (source of truth); keep field names in sync.
/** Attachment metadata returned by GET /requests/:id (no internal storage fields). */
export interface AttachmentSummary {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

/** A single request's detail, returned by GET /requests/:id, for the Review screen. */
export interface RequestDetail {
  id: string;
  sender_company: string | null;
  sender_contact: string | null;
  sender_email: string | null;
  source_subject: string | null;
  source_body: string | null;
  request_type: string;
  status: string;
  overall_confidence: number | null;
  current_node: string;
  created_at: string;
  attachments: AttachmentSummary[];
}

export async function fetchRequest(id: string): Promise<RequestDetail> {
  const res = await client.get<{ data: RequestDetail }>(`/requests/${id}`);
  return res.data.data;
}

/** Loads a single request's detail for the Review screen. */
export function useRequest(id: string | undefined) {
  return useQuery({
    queryKey: requestKeys.detail(id ?? ''),
    queryFn: () => fetchRequest(id as string),
    enabled: Boolean(id),
  });
}

interface CreateRequestFilePayload {
  kind: 'file';
  files: File[];
}

interface CreateRequestPastePayload {
  kind: 'paste';
  sourceBody: string;
}

export type CreateRequestPayload = CreateRequestFilePayload | CreateRequestPastePayload;

interface CreateRequestResponse {
  request_id: string;
  status: string;
  current_node: string;
}

export async function postRequest(payload: CreateRequestPayload): Promise<CreateRequestResponse> {
  if (payload.kind === 'file') {
    const form = new FormData();
    form.append('channel', 'upload');
    for (const file of payload.files) {
      form.append('files', file);
    }
    const res = await client.post<{ data: CreateRequestResponse }>('/requests', form);
    return res.data.data;
  }

  const res = await client.post<{ data: CreateRequestResponse }>('/requests', {
    channel: 'email',
    source_body: payload.sourceBody,
  });
  return res.data.data;
}

export function useCreateRequest(onError: (message: string) => void) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: postRequest,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: requestKeys.lists() });
      if (!data.request_id) {
        console.warn('POST /requests returned 202 without request_id; navigating to inbox');
        navigate('/');
        return;
      }
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidPattern.test(data.request_id)) {
        console.warn('POST /requests returned non-UUID request_id; navigating to inbox');
        navigate('/');
        return;
      }
      navigate(`/requests/${data.request_id}`);
    },
    onError: (error: AxiosError<{ error?: string; message?: string }>) => {
      const status = error.response?.status;
      if (status && status >= 500) {
        onError('Something went wrong. Please try again.');
        return;
      }
      const serverMessage = error.response?.data?.message;
      if (serverMessage) {
        onError(serverMessage);
        return;
      }
      onError(resolveServerError(error.response?.data?.error));
    },
  });
}
