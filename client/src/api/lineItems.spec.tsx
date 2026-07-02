import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRemapLineItem } from './lineItems';
import { requestKeys, type RequestDetail } from './requests';

const { mockPatch, mockGet } = vi.hoisted(() => ({ mockPatch: vi.fn(), mockGet: vi.fn() }));
vi.mock('./client', () => ({ default: { patch: mockPatch, get: mockGet } }));

const REQ = 'req-1';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Seed: one line (qty 2 @ 500 = 1000), subtotal 1000, discount 100, total 900.
function seedDetail(): RequestDetail {
  return {
    id: REQ,
    line_items: [{ id: 'line-1', position: 1, quantity: 2, unit_price_minor: 500 }],
    quote: {
      quote_number: 'Q1',
      status: 'draft',
      currency: 'GBP',
      subtotal_minor: 1000,
      discount_minor: 100,
      total_minor: 900,
      lead_time_days: 5,
      pdf_storage_url: null,
      pdf_generated_at: null,
      email_draft_subject: null,
      email_draft_body: null,
      lines: [
        {
          position: 1,
          sku_id: 'sku-old',
          description: 'X',
          quantity: 2,
          unit_price_minor: 500,
          amount_minor: 1000,
        },
      ],
    },
  } as unknown as RequestDetail;
}

function serverQuote(total: number) {
  return {
    data: {
      data: {
        request_id: REQ,
        line: {
          id: 'line-1',
          matched_sku_id: 'sku-new',
          quantity: 2,
          unit_price_minor: 0,
          match_confidence: 1,
        },
        quote: {
          quote_id: 'q1',
          subtotal_minor: total + 100,
          discount_minor: 100,
          total_minor: total,
          lead_time_days: 7,
          blocked: false,
        },
      },
    },
  };
}

function setup() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  qc.setQueryData(requestKeys.detail(REQ), seedDetail());
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
  return { qc, wrapper };
}

const total = (qc: QueryClient): number | undefined =>
  qc.getQueryData<RequestDetail>(requestKeys.detail(REQ))?.quote?.total_minor;

beforeEach(() => {
  mockPatch.mockReset();
  mockGet.mockReset();
});

describe('useRemapLineItem (US-E6-3)', () => {
  it('applies an optimistic total on confirm, then reconciles to the server total (FR-1/FR-2)', async () => {
    const d = deferred<unknown>();
    mockPatch.mockReturnValue(d.promise);
    const { qc, wrapper } = setup();
    const { result } = renderHook(() => useRemapLineItem(REQ), { wrapper });

    // New price 900: amount 2*900=1800, subtotal 1000-1000+1800=1800, total 1800-100=1700.
    act(() => {
      result.current.mutate({
        lineId: 'line-1',
        payload: { sku_id: 'sku-new' },
        optimisticUnitPriceMinor: 900,
      });
    });
    await waitFor(() => expect(total(qc)).toBe(1700));

    // Server disagrees (pricing rules): authoritative total 1600.
    await act(async () => {
      d.resolve(serverQuote(1600));
      await d.promise;
    });
    await waitFor(() => expect(total(qc)).toBe(1600));
  });

  it('rolls back to the previous server total when the PATCH fails (EC-03)', async () => {
    const d = deferred<unknown>();
    mockPatch.mockReturnValue(d.promise);
    const { qc, wrapper } = setup();
    const { result } = renderHook(() => useRemapLineItem(REQ), { wrapper });

    act(() => {
      result.current.mutate({
        lineId: 'line-1',
        payload: { sku_id: 'sku-new' },
        optimisticUnitPriceMinor: 900,
      });
    });
    await waitFor(() => expect(total(qc)).toBe(1700));

    await act(async () => {
      d.reject(new Error('network'));
      await d.promise.catch(() => undefined);
    });
    await waitFor(() => expect(total(qc)).toBe(900));
  });

  it('keeps the latest re-map when an earlier response arrives out of order (EC-02)', async () => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    mockPatch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { qc, wrapper } = setup();
    const { result } = renderHook(() => useRemapLineItem(REQ), { wrapper });

    act(() => {
      result.current.mutate({
        lineId: 'line-1',
        payload: { sku_id: 'a' },
        optimisticUnitPriceMinor: 900,
      });
    });
    act(() => {
      result.current.mutate({
        lineId: 'line-1',
        payload: { sku_id: 'b' },
        optimisticUnitPriceMinor: 1000,
      });
    });

    // The later re-map (second) resolves first with total 2000...
    await act(async () => {
      second.resolve(serverQuote(2000));
      await second.promise;
    });
    await waitFor(() => expect(total(qc)).toBe(2000));

    // ...then the earlier one lands late with a now-stale 1500; it must NOT overwrite 2000.
    await act(async () => {
      first.resolve(serverQuote(1500));
      await first.promise;
    });
    await waitFor(() => expect(total(qc)).toBe(2000));
  });

  it('an earlier re-map resolving while a newer one is in flight does not clobber it (EC-02)', async () => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    mockPatch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { qc, wrapper } = setup();
    const { result } = renderHook(() => useRemapLineItem(REQ), { wrapper });

    // A (optimistic 900) then B (optimistic 1000) both issued and in flight; B is newest.
    act(() => {
      result.current.mutate({
        lineId: 'line-1',
        payload: { sku_id: 'a' },
        optimisticUnitPriceMinor: 900,
      });
    });
    act(() => {
      result.current.mutate({
        lineId: 'line-1',
        payload: { sku_id: 'b' },
        optimisticUnitPriceMinor: 1000,
      });
    });
    // B's optimistic total is showing: subtotal 1800(after A) - 1800 + 2*1000 = 2000, total 1900.
    await waitFor(() => expect(total(qc)).toBe(1900));

    // A (older) resolves FIRST with a stale server total; it must be ignored, B's optimistic stands.
    await act(async () => {
      first.resolve(serverQuote(1500));
      await first.promise;
    });
    await waitFor(() => expect(total(qc)).toBe(1900));

    // B (newest) resolves and reconciles to its server total.
    await act(async () => {
      second.resolve(serverQuote(2000));
      await second.promise;
    });
    await waitFor(() => expect(total(qc)).toBe(2000));
  });

  it('reconciles from the response even without an optimistic hint (non-optimistic caller)', async () => {
    mockPatch.mockResolvedValue(serverQuote(1234));
    const { qc, wrapper } = setup();
    const { result } = renderHook(() => useRemapLineItem(REQ), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ lineId: 'line-1', payload: { sku_id: 'sku-new' } });
    });
    await waitFor(() => expect(total(qc)).toBe(1234));
  });
});
