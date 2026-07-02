import { createElement } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import {
  approveQuote,
  downloadQuotePdf,
  resolveApproveQuoteError,
  useApproveQuote,
} from './quotes';
import type { ApproveQuoteError } from './quotes';
import { requestKeys } from './requests';
import type { QuoteDetail, RequestDetail } from './requests';
import { GENERIC_ERROR } from '../lib/errorMessages';

const { mockGet, mockPost } = vi.hoisted(() => ({ mockGet: vi.fn(), mockPost: vi.fn() }));

vi.mock('./client', () => ({
  default: { get: mockGet, post: mockPost },
}));

const quoteFixture: QuoteDetail = {
  quote_number: 'Q-2041',
  status: 'draft',
  subtotal_minor: 378000,
  discount_minor: 0,
  total_minor: 412000,
  currency: 'GBP',
  lead_time_days: 7,
  pdf_storage_url: null,
  pdf_generated_at: null,
  email_draft_subject: null,
  email_draft_body: null,
  lines: [],
};

const requestFixture: RequestDetail = {
  id: 'req-1',
  sender_company: 'Apex Fabrication',
  sender_contact: 'James Okafor',
  sender_email: 'james.okafor@apexfab.example',
  source_subject: 'RFQ',
  source_body: null,
  request_type: 'catalog_rfq',
  status: 'priced',
  overall_confidence: 0.98,
  current_node: 'price',
  created_at: '2026-06-24T10:00:00.000Z',
  attachments: [],
  routing: null,
  routing_reasons: [],
  line_items: [],
  quote: quoteFixture,
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

describe('approveQuote', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('posts to the request-scoped endpoint and returns the unwrapped quote', async () => {
    mockPost.mockResolvedValue({ data: { data: { quote: quoteFixture } } });

    const result = await approveQuote('req-1');

    expect(mockPost).toHaveBeenCalledWith('/requests/req-1/quote');
    expect(result).toEqual({ quote: quoteFixture });
  });
});

describe('downloadQuotePdf', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('fetches the pdf as a blob from the request-scoped endpoint', async () => {
    const blob = new Blob(['PDF-BYTES'], { type: 'application/pdf' });
    mockGet.mockResolvedValue({ data: blob });

    const result = await downloadQuotePdf('req-1');

    expect(mockGet).toHaveBeenCalledWith('/requests/req-1/quote/pdf', { responseType: 'blob' });
    expect(result).toBe(blob);
  });
});

describe('resolveApproveQuoteError', () => {
  it('prefers the server message for a 409', () => {
    const error = {
      response: { status: 409, data: { message: 'Quote has not been priced yet.' } },
    } as ApproveQuoteError;

    expect(resolveApproveQuoteError(error)).toBe('Quote has not been priced yet.');
  });

  it('falls back to generic 409 copy when the server sends no message', () => {
    const error = { response: { status: 409, data: {} } } as ApproveQuoteError;

    expect(resolveApproveQuoteError(error)).toBe('This quote cannot be approved right now.');
  });

  it('prefers the server message for a 424', () => {
    const error = {
      response: { status: 424, data: { message: 'PDF rendering failed.' } },
    } as ApproveQuoteError;

    expect(resolveApproveQuoteError(error)).toBe('PDF rendering failed.');
  });

  it('falls back to generic 424 copy when the server sends no message', () => {
    const error = { response: { status: 424, data: {} } } as ApproveQuoteError;

    expect(resolveApproveQuoteError(error)).toBe(
      'Could not generate the quote PDF. Please try again.',
    );
  });

  it('falls back to the generic error message for a 500', () => {
    const error = { response: { status: 500, data: {} } } as ApproveQuoteError;

    expect(resolveApproveQuoteError(error)).toBe(GENERIC_ERROR);
  });

  it('falls back to the generic error message for a network failure with no response', () => {
    const error = {} as ApproveQuoteError;

    expect(resolveApproveQuoteError(error)).toBe(GENERIC_ERROR);
  });
});

describe('useApproveQuote', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('invalidates the request detail and list caches on success', async () => {
    const queryClient = makeQueryClient();
    queryClient.setQueryData(requestKeys.detail('req-1'), requestFixture);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const readyQuote: QuoteDetail = {
      ...quoteFixture,
      status: 'ready',
      pdf_storage_url: 'https://cdn.example/q-2041.pdf',
      pdf_generated_at: '2026-07-01T00:00:00.000Z',
    };
    mockPost.mockResolvedValue({ data: { data: { quote: readyQuote } } });

    const { result } = renderHook(() => useApproveQuote('req-1'), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate();
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: requestKeys.detail('req-1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: requestKeys.lists() });
  });

  it('succeeds on an idempotent re-call against an already-READY quote', async () => {
    const queryClient = makeQueryClient();
    const readyRequest: RequestDetail = {
      ...requestFixture,
      quote: { ...quoteFixture, status: 'ready', pdf_storage_url: 'https://cdn.example/q.pdf' },
    };
    queryClient.setQueryData(requestKeys.detail('req-1'), readyRequest);
    mockPost.mockResolvedValue({ data: { data: { quote: readyRequest.quote } } });

    const { result } = renderHook(() => useApproveQuote('req-1'), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate();
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('exposes a 409 failure for the caller to resolve into display copy', async () => {
    const queryClient = makeQueryClient();
    queryClient.setQueryData(requestKeys.detail('req-1'), requestFixture);
    const axiosError = {
      response: { status: 409, data: { message: 'Quote has not been priced yet.' } },
    };
    mockPost.mockRejectedValue(axiosError);

    const { result } = renderHook(() => useApproveQuote('req-1'), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate();
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(resolveApproveQuoteError(result.current.error as ApproveQuoteError)).toBe(
      'Quote has not been priced yet.',
    );
    // The cache is untouched on failure.
    expect(
      queryClient.getQueryData<RequestDetail>(requestKeys.detail('req-1'))?.quote?.status,
    ).toBe('draft');
  });

  it('exposes a 424 failure for the caller to resolve into display copy', async () => {
    const queryClient = makeQueryClient();
    queryClient.setQueryData(requestKeys.detail('req-1'), requestFixture);
    const axiosError = { response: { status: 424, data: {} } };
    mockPost.mockRejectedValue(axiosError);

    const { result } = renderHook(() => useApproveQuote('req-1'), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate();
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(resolveApproveQuoteError(result.current.error as ApproveQuoteError)).toBe(
      'Could not generate the quote PDF. Please try again.',
    );
  });
});
