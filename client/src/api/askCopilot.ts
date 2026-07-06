import { useMutation } from '@tanstack/react-query';
import client from './client';
import type { AskCopilotResponse } from './interface/ask-copilot';

export async function askCopilot(requestId: string, question: string): Promise<AskCopilotResponse> {
  const res = await client.post<{ data: AskCopilotResponse }>(
    `/requests/${requestId}/copilot/ask`,
    {
      question,
    },
  );
  return res.data.data;
}

/** Asks the agentic copilot a free-text question about a request. User-triggered, so a mutation
 * rather than a query. */
export function useAskCopilot(requestId: string) {
  return useMutation({
    mutationFn: (question: string) => askCopilot(requestId, question),
  });
}
