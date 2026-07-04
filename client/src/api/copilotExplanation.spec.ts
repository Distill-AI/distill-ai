import { createElement } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import {
  copilotExplanationKeys,
  fetchCopilotExplanation,
  useCopilotExplanation,
} from './copilotExplanation';
import type { CopilotExplanation } from './interface/copilot-explanation';

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock('./client', () => ({
  default: { get: mockGet },
}));

const explanationFixture: CopilotExplanation = {
  explanation: 'Routed to needs review because the deal value exceeds the auto-send cap.',
  degraded: false,
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

describe('copilotExplanationKeys', () => {
  it('all() returns the root key', () => {
    expect(copilotExplanationKeys.all()).toEqual(['copilotExplanation']);
  });

  it('byRequest() nests under all() with the request id', () => {
    expect(copilotExplanationKeys.byRequest('req-1')).toEqual([
      'copilotExplanation',
      'request',
      'req-1',
    ]);
  });
});

describe('fetchCopilotExplanation', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('fetches the request-scoped endpoint and returns the unwrapped explanation', async () => {
    mockGet.mockResolvedValue({ data: { data: explanationFixture } });

    const result = await fetchCopilotExplanation('req-1');

    expect(mockGet).toHaveBeenCalledWith('/requests/req-1/copilot-explanation');
    expect(result).toEqual(explanationFixture);
  });
});

describe('useCopilotExplanation', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('fetches and returns the explanation when a request id is provided', async () => {
    mockGet.mockResolvedValue({ data: { data: explanationFixture } });
    const queryClient = makeQueryClient();

    const { result } = renderHook(() => useCopilotExplanation('req-1'), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(explanationFixture);
    expect(mockGet).toHaveBeenCalledWith('/requests/req-1/copilot-explanation');
  });

  it('does not fetch when the request id is undefined', () => {
    const queryClient = makeQueryClient();

    const { result } = renderHook(() => useCopilotExplanation(undefined), {
      wrapper: makeWrapper(queryClient),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });
});
