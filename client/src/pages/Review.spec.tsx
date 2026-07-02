import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Review } from './Review';
import { PageHeaderProvider, usePageHeader } from '../context/PageHeaderContext';
import type { RequestDetail } from '../api/requests';

const { mockUseRequest, mockDownload, mockNavigate } = vi.hoisted(() => ({
  mockUseRequest: vi.fn(),
  mockDownload: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('../api/requests', () => ({
  useRequest: () => mockUseRequest(),
}));
vi.mock('../api/attachments', () => ({
  downloadAttachment: mockDownload,
}));
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock('../components/review/DeclineModal', () => ({
  DeclineModal: ({ open }: { open: boolean }) =>
    open ? <div role="dialog">Decline modal</div> : null,
}));

const detail: RequestDetail = {
  id: 'req-1',
  sender_company: 'Apex Fabrication',
  sender_contact: 'Dana Reyes',
  sender_email: 'dana@apex.example',
  source_subject: 'RFQ: 200x steel brackets',
  source_body: 'Hi, please quote 200 steel brackets.',
  request_type: 'catalog_rfq',
  status: 'needs_review',
  overall_confidence: 0.96,
  current_node: 'extract',
  created_at: '2026-06-24T10:00:00.000Z',
  routing: 'needs_review',
  routing_reasons: [
    {
      code: 'low_line_confidence',
      message: 'Line confidence 0.64 below auto threshold 0.95',
      source: 'confidence',
    },
  ],
  attachments: [
    {
      id: 'att-1',
      filename: 'rfq_apex.pdf',
      mime_type: 'application/pdf',
      size_bytes: 1258291,
      parse_status: 'parsed',
      parse_error_reason: null,
      created_at: '2026-06-24T10:00:00.000Z',
    },
  ],
  line_items: [
    {
      id: 'li-1',
      position: 1,
      raw_text: '200x steel brackets',
      quantity: 200,
      unit_price_minor: 1425,
      match_confidence: 0.62,
      matched_sku: { id: 'sku-1', sku_code: 'SKU-061', name: 'Steel Bracket' },
      flags: ['close_tie'],
    },
  ],
  quote: {
    quote_number: 'Q-2041',
    status: 'draft',
    subtotal_minor: 300000,
    discount_minor: 15000,
    total_minor: 285000,
    currency: 'NGN',
    lead_time_days: 5,
    pdf_storage_url: null,
    pdf_generated_at: null,
    email_draft_subject: null,
    email_draft_body: null,
    lines: [
      {
        position: 1,
        sku_id: 'sku-1',
        description: 'Steel Bracket',
        quantity: 200,
        unit_price_minor: 1425,
        amount_minor: 285000,
      },
    ],
  },
};

function PageHeaderSlots() {
  const { title, actions } = usePageHeader();
  return (
    <>
      <div data-testid="topbar-title">{title}</div>
      <div data-testid="topbar-actions">{actions}</div>
    </>
  );
}

function renderReview() {
  return render(
    <PageHeaderProvider>
      <MemoryRouter initialEntries={['/requests/req-1/review']}>
        <PageHeaderSlots />
        <Routes>
          <Route path="/requests/:id/review" element={<Review />} />
        </Routes>
      </MemoryRouter>
    </PageHeaderProvider>,
  );
}

describe('Review', () => {
  beforeEach(() => {
    mockUseRequest.mockReset();
    mockDownload.mockReset();
    mockNavigate.mockReset();
  });

  it('shows a loading state while the request loads', () => {
    mockUseRequest.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderReview();
    expect(screen.getByText(/loading request/i)).toBeInTheDocument();
  });

  it('shows an error state when the request fails to load', () => {
    mockUseRequest.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderReview();
    expect(screen.getByText(/could not load this request/i)).toBeInTheDocument();
  });

  it('renders the original request pane with sender, body and the attachment download', () => {
    mockUseRequest.mockReturnValue({ data: detail, isLoading: false, isError: false });
    renderReview();

    expect(screen.getByRole('heading', { name: /review · apex fabrication/i })).toBeInTheDocument();
    expect(screen.getByText('dana@apex.example')).toBeInTheDocument();
    expect(screen.getByText(/please quote 200 steel brackets/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download rfq_apex\.pdf/i })).toBeInTheDocument();
  });

  it('renders all three panes with real parsed lines and the suggested-quote total (AC-01, AC-03)', () => {
    mockUseRequest.mockReturnValue({ data: detail, isLoading: false, isError: false });
    renderReview();

    // Pane headings.
    expect(screen.getByText(/parsed structure/i)).toBeInTheDocument();
    expect(screen.getByText(/suggested quote/i)).toBeInTheDocument();

    // Parsed pane: the line, its matched SKU, a confidence chip (62%) and a visible flag marker.
    expect(screen.getByText('200x steel brackets')).toBeInTheDocument();
    expect(screen.getByText('SKU-061')).toBeInTheDocument();
    expect(screen.getByText('62%')).toBeInTheDocument();
    expect(screen.getByText(/close tie/i)).toBeInTheDocument();

    // Quote pane: the running total renders.
    expect(screen.getByTestId('quote-total')).toHaveTextContent(/2,850\.00/);
  });

  it('shows a defined not-priced state in the quote pane when there is no quote (EC-01)', () => {
    mockUseRequest.mockReturnValue({
      data: { ...detail, quote: null },
      isLoading: false,
      isError: false,
    });
    renderReview();

    expect(screen.getByText(/not priced yet/i)).toBeInTheDocument();
  });

  it('offers a retry on a failed fetch (EC-02)', () => {
    const refetch = vi.fn();
    mockUseRequest.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
    renderReview();

    screen.getByRole('button', { name: /retry/i }).click();
    expect(refetch).toHaveBeenCalled();
  });

  it('renders the Decline button for a needs_review request', () => {
    mockUseRequest.mockReturnValue({ data: detail, isLoading: false, isError: false });
    renderReview();

    expect(screen.getByRole('button', { name: /decline/i })).toBeInTheDocument();
  });

  it('shows a declined notice instead of action buttons when status is declined', () => {
    mockUseRequest.mockReturnValue({
      data: { ...detail, status: 'declined' },
      isLoading: false,
      isError: false,
    });
    renderReview();

    expect(screen.queryByRole('button', { name: /decline/i })).not.toBeInTheDocument();
    expect(screen.getByText(/this request has been declined/i)).toBeInTheDocument();
  });

  it('renders the back button in the title slot', () => {
    mockUseRequest.mockReturnValue({ data: detail, isLoading: false, isError: false });
    renderReview();

    expect(screen.getByRole('link', { name: /back to inbox/i })).toBeInTheDocument();
  });

  it('opens the DeclineModal when Decline is clicked', async () => {
    const user = userEvent.setup();
    mockUseRequest.mockReturnValue({ data: detail, isLoading: false, isError: false });
    renderReview();

    await user.click(screen.getByRole('button', { name: /decline/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders the routing-reasons banner with flagged reasons', () => {
    mockUseRequest.mockReturnValue({ data: detail, isLoading: false, isError: false });
    renderReview();

    expect(screen.getByRole('button', { name: /review flags/i })).toBeInTheDocument();
  });

  it('shows an all-clear banner for auto-eligible requests', () => {
    const autoDetail = { ...detail, routing: 'auto_eligible', routing_reasons: [] };
    mockUseRequest.mockReturnValue({ data: autoDetail, isLoading: false, isError: false });
    renderReview();

    expect(screen.getByText(/all clear/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /review flags/i })).not.toBeInTheDocument();
  });

  it('disables Request clarification unless status is needs_clarification', () => {
    mockUseRequest.mockReturnValue({
      data: { ...detail, status: 'needs_review' },
      isLoading: false,
      isError: false,
    });
    renderReview();

    expect(screen.getByRole('button', { name: /request clarification/i })).toBeDisabled();
  });

  it('navigates to the Clarification screen when Request clarification is clicked', async () => {
    const user = userEvent.setup();
    mockUseRequest.mockReturnValue({
      data: { ...detail, status: 'needs_clarification' },
      isLoading: false,
      isError: false,
    });
    renderReview();

    const button = screen.getByRole('button', { name: /request clarification/i });
    expect(button).toBeEnabled();

    await user.click(button);

    expect(mockNavigate).toHaveBeenCalledWith('/requests/req-1/clarification');
  });

  it('enables Approve & generate when the request has a quote and is in an approvable status', () => {
    mockUseRequest.mockReturnValue({
      data: { ...detail, status: 'priced' },
      isLoading: false,
      isError: false,
    });
    renderReview();

    expect(screen.getByRole('button', { name: /approve & generate/i })).toBeEnabled();
  });

  it('disables Approve & generate when the request has no quote yet', () => {
    mockUseRequest.mockReturnValue({
      data: { ...detail, status: 'needs_review', quote: null },
      isLoading: false,
      isError: false,
    });
    renderReview();

    expect(screen.getByRole('button', { name: /approve & generate/i })).toBeDisabled();
  });

  it('disables Approve & generate when the status is not approvable', () => {
    mockUseRequest.mockReturnValue({
      data: { ...detail, status: 'needs_clarification' },
      isLoading: false,
      isError: false,
    });
    renderReview();

    expect(screen.getByRole('button', { name: /approve & generate/i })).toBeDisabled();
  });

  it('navigates to the Quote Output screen when Approve & generate is clicked', async () => {
    const user = userEvent.setup();
    mockUseRequest.mockReturnValue({
      data: { ...detail, status: 'priced' },
      isLoading: false,
      isError: false,
    });
    renderReview();

    await user.click(screen.getByRole('button', { name: /approve & generate/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/requests/req-1/quote');
  });
});
