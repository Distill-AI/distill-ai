import type { AxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import client from './client';
import { resolveServerError } from '../lib/errorMessages';
import type { RequestStatus, RequestType } from './interface/request-status';
import { isRequestStatus } from './interface/request-status';

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

/** Row shape for the Inbox list (GET /requests). */
export interface RequestSummary {
  id: string;
  sender_company: string | null;
  sender_contact: string | null;
  source_subject: string | null;
  request_type: RequestType;
  overall_confidence: number | null;
  status: RequestStatus;
  created_at: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

// MVP: reads the first page only (server defaults: page 1, limit 50). Pagination metadata under
// `meta` is ignored until the Inbox grows a pagination UI; see #42 for the server contract.
export async function fetchRequests(): Promise<RequestSummary[]> {
  const res = await client.get<{ data: RequestSummary[] }>('/requests');
  return res.data.data;
}

/** Polls GET /requests so the Inbox reflects live status changes. */
export function useRequests() {
  return useQuery({
    queryKey: requestKeys.lists(),
    queryFn: fetchRequests,
    refetchInterval: 5000,
  });
}

/**
 * Builds the optimistic row inserted at the top of the Inbox the instant a
 * request is submitted, before the backend has parsed it. The POST response
 * only carries id/status, so the descriptive fields are best-effort from the
 * submitted payload and reconcile on the next GET /requests refetch.
 */
export function buildOptimisticSummary(
  data: CreateRequestResponse,
  variables: CreateRequestPayload,
  createdAt: string = new Date().toISOString(),
): RequestSummary {
  const sourceSubject =
    variables.kind === 'file'
      ? (variables.files[0]?.name ?? null)
      : variables.sourceBody.trim().slice(0, 80) || null;

  // Validate the server status at runtime; fall back to 'parsing' for any
  // missing or unrecognized value so the badge never indexes an unknown key.
  const status: RequestStatus = isRequestStatus(data.status) ? data.status : 'parsing';

  return {
    id: data.request_id,
    sender_company: null,
    sender_contact: null,
    source_subject: sourceSubject,
    request_type: 'unknown',
    overall_confidence: null,
    status,
    created_at: createdAt,
  };
}

export interface DeclineResult {
  request_id: string;
  status: string;
  reason: string;
}

export async function declineRequest(
  requestId: string,
  payload: { reason: string },
): Promise<DeclineResult> {
  const res = await client.post<{ data: DeclineResult }>(
    `/requests/${requestId}/decline`,
    payload,
  );
  return res.data.data;
}

export function useDeclineRequest() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation<DeclineResult, AxiosError, { requestId: string; reason: string }>({
    mutationFn: ({ requestId, reason }) =>
      declineRequest(requestId, { reason }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: requestKeys.detail(variables.requestId) });
      queryClient.invalidateQueries({ queryKey: requestKeys.lists() });
      navigate('/');
    },
  });
}

export function useCreateRequest(onError: (message: string) => void) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: postRequest,
    onSuccess: (data, variables) => {
      if (!data.request_id || !UUID_PATTERN.test(data.request_id)) {
        const reason = data.request_id ? 'non-UUID' : 'no';
        console.warn(`POST /requests returned 202 with ${reason} request_id; navigating to inbox`);
        queryClient.invalidateQueries({ queryKey: requestKeys.lists() });
        navigate('/');
        return;
      }

      const summary = buildOptimisticSummary(data, variables);
      queryClient.setQueryData<RequestSummary[]>(requestKeys.lists(), (prev) => [
        summary,
        ...(prev ?? []).filter((row) => row.id !== summary.id),
      ]);
      queryClient.invalidateQueries({ queryKey: requestKeys.lists() });
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
