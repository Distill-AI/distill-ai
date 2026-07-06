import { createElement } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { askCopilot, useAskCopilot } from './askCopilot';
import type { AskCopilotResponse } from './interface/ask-copilot';

const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn() }));

vi.mock('./client', () => ({
  default: { post: mockPost },
}));

const askFixture: AskCopilotResponse = {
  answer: 'This needs review because confidence is below threshold.',
  trace: [
    {
      thought: 'Checking routing.',
      tool: 'explain_routing',
      input: {},
      output: { degraded: false },
    },
  ],
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('askCopilot', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('posts the question to the request-scoped endpoint and returns the unwrapped answer', async () => {
    mockPost.mockResolvedValue({ data: { data: askFixture } });

    const result = await askCopilot('req-1', 'why is this flagged?');

    expect(mockPost).toHaveBeenCalledWith('/requests/req-1/copilot/ask', {
      question: 'why is this flagged?',
    });
    expect(result).toEqual(askFixture);
  });
});

describe('useAskCopilot', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('is idle until triggered, then resolves with the answer', async () => {
    mockPost.mockResolvedValue({ data: { data: askFixture } });
    const queryClient = makeQueryClient();

    const { result } = renderHook(() => useAskCopilot('req-1'), {
      wrapper: makeWrapper(queryClient),
    });

    expect(result.current.isIdle).toBe(true);

    act(() => {
      result.current.mutate('why is this flagged?');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(askFixture);
    expect(mockPost).toHaveBeenCalledWith('/requests/req-1/copilot/ask', {
      question: 'why is this flagged?',
    });
  });

  it('surfaces an error without throwing when the request fails', async () => {
    mockPost.mockRejectedValue(new Error('boom'));
    const queryClient = makeQueryClient();

    const { result } = renderHook(() => useAskCopilot('req-1'), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.mutate('why is this flagged?');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
