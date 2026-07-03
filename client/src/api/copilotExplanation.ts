import { useQuery } from '@tanstack/react-query';
import client from './client';
import type { CopilotExplanation } from './interface/copilot-explanation';

export const copilotExplanationKeys = {
  all: () => ['copilotExplanation'] as const,
  byRequest: (requestId: string) =>
    [...copilotExplanationKeys.all(), 'request', requestId] as const,
};

export async function fetchCopilotExplanation(requestId: string): Promise<CopilotExplanation> {
  const res = await client.get<{ data: CopilotExplanation }>(
    `/requests/${requestId}/copilot-explanation`,
  );
  return res.data.data;
}

/** Loads the advisory Copilot explanation of why a request was routed the way it was. */
export function useCopilotExplanation(requestId: string | undefined) {
  return useQuery({
    queryKey: copilotExplanationKeys.byRequest(requestId ?? ''),
    queryFn: () => fetchCopilotExplanation(requestId as string),
    enabled: Boolean(requestId),
    retry: false, // EC-01: a failing advisory call must not retry-loop; resolve to isError quickly
  });
}
