import { render, screen, fireEvent } from '@testing-library/react';
import { RemapDrawer } from './RemapDrawer';

const { mockUseCandidates, mockUseSkuSearch, mockMutate, mockUseRemap } = vi.hoisted(() => ({
  mockUseCandidates: vi.fn(),
  mockUseSkuSearch: vi.fn(),
  mockMutate: vi.fn(),
  mockUseRemap: vi.fn(),
}));

vi.mock('../../api/lineItems', () => ({
  useCandidates: (lineId: string | null) => mockUseCandidates(lineId),
  useRemapLineItem: () => mockUseRemap(),
}));
vi.mock('../../api/catalog', () => ({
  useSkuSearch: (q: string) => mockUseSkuSearch(q),
}));

const CANDIDATE = {
  sku_id: 'sku-1',
  sku_code: 'SKU-061',
  name: 'M6 Hex Bolt',
  base_price_minor: 1000,
  currency: 'NGN',
  confidence: 0.62,
};

function renderDrawer() {
  return render(
    <RemapDrawer requestId="req-1" lineId="li-1" lineLabel="M6 bolts x100" onClose={vi.fn()} />,
  );
}

describe('RemapDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCandidates.mockReturnValue({ data: [CANDIDATE], isLoading: false, isSuccess: true });
    mockUseSkuSearch.mockReturnValue({ data: [], isFetching: false });
    mockUseRemap.mockReturnValue({ mutate: mockMutate, isPending: false, isError: false });
  });

  it('AC-03: lists ranked candidates with confidence and price', () => {
    renderDrawer();
    expect(screen.getByText('SKU-061', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('62%')).toBeInTheDocument();
    expect(screen.getByText(/10\.00/)).toBeInTheDocument(); // 1000 minor -> 10.00
  });

  it('AC-01: selecting a candidate and confirming calls the PATCH with that SKU', () => {
    renderDrawer();
    fireEvent.click(screen.getByText('SKU-061', { exact: false }));
    fireEvent.click(screen.getByRole('button', { name: /confirm match/i }));

    // US-E6-3: also forwards the picked SKU's price so the total can update optimistically.
    expect(mockMutate).toHaveBeenCalledWith(
      { lineId: 'li-1', payload: { sku_id: 'sku-1' }, optimisticUnitPriceMinor: 1000 },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('EC-01: a line with no candidates opens straight into manual search', () => {
    mockUseCandidates.mockReturnValue({ data: [], isLoading: false, isSuccess: true });
    renderDrawer();
    expect(screen.getByLabelText(/search catalog/i)).toBeInTheDocument();
  });

  it('AC-02: a manual-search hit can be selected and confirmed', () => {
    mockUseSkuSearch.mockReturnValue({
      data: [
        {
          sku_id: 'sku-9',
          sku_code: 'SKU-099',
          name: 'Washer',
          base_price_minor: 300,
          currency: 'NGN',
        },
      ],
      isFetching: false,
    });
    renderDrawer();
    fireEvent.click(screen.getByRole('tab', { name: /search catalog/i }));
    fireEvent.change(screen.getByLabelText(/search catalog/i), { target: { value: 'washer' } });
    fireEvent.click(screen.getByText('SKU-099', { exact: false }));
    fireEvent.click(screen.getByRole('button', { name: /confirm match/i }));

    expect(mockMutate).toHaveBeenCalledWith(
      { lineId: 'li-1', payload: { sku_id: 'sku-9' }, optimisticUnitPriceMinor: 300 },
      expect.anything(),
    );
  });

  it('EC-02: a search with no results shows a no-results state', () => {
    renderDrawer();
    fireEvent.click(screen.getByRole('tab', { name: /search catalog/i }));
    fireEvent.change(screen.getByLabelText(/search catalog/i), { target: { value: 'zzz' } });
    expect(screen.getByText(/no skus match/i)).toBeInTheDocument();
  });

  it('EC-03: a failed confirm surfaces the error', () => {
    mockUseRemap.mockReturnValue({ mutate: mockMutate, isPending: false, isError: true });
    renderDrawer();
    expect(screen.getByText(/re-map failed/i)).toBeInTheDocument();
  });
});
