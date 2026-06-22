import { useMutation } from '@tanstack/react-query';
import client from './client';

export interface CreateRequestPayload {
  channel: 'email';
  source_body: string;
}

export interface CreatedRequest {
  id: string;
  status: string;
}

async function createRequest(payload: CreateRequestPayload): Promise<CreatedRequest> {
  const res = await client.post<{ data: CreatedRequest }>('/requests', payload);
  return res.data.data;
}

export function useCreateRequest() {
  return useMutation({ mutationFn: createRequest });
}
