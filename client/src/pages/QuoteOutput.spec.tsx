import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QuoteOutput } from './QuoteOutput';
import { PageHeaderProvider, usePageHeader } from '../context/PageHeaderContext';
import type { RequestDetail, QuoteDetail } from '../api/requests';

const {
  mockUseRequest,
  mockUseApproveQuote,
  mockApproveMutate,
  mockDownloadQuotePdf,
  mockUseClipboardCopy,
  mockCopy,
} = vi.hoisted(() => ({
  mockUseRequest: vi.fn(),
  mockUseApproveQuote: vi.fn(),
  mockApproveMutate: vi.fn(),
  mockDownloadQuotePdf: vi.fn(),
  mockUseClipboardCopy: vi.fn(),
  mockCopy: vi.fn(),
}));

vi.mock('../api/requests', () => ({
  useRequest: () => mockUseRequest(),
}));

vi.mock('../api/quotes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/quotes')>();
  return {
    ...actual,
    useApproveQuote: () => mockUseApproveQuote(),
    downloadQuotePdf: (requestId: string) => mockDownloadQuotePdf(requestId),
  };
});

vi.mock('../hooks/useClipboardCopy', () => ({
  useClipboardCopy: () => mockUseClipboardCopy(),
}));

const draftQuote: QuoteDetail = {
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
  lines: [
    {
      position: 1,
      sku_id: 'sku-1',
      description: 'Hex Bolt M10x50 Stainless A4',
      quantity: 2000,
      unit_price_minor: 45,
      amount_minor: 90000,
    },
  ],
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
  attachments: [
    {
      id: 'att-1',
      filename: 'RFQ_Apex_Oct24.eml',
      mime_type: 'message/rfc822',
      size_bytes: 2048,
      created_at: '2026-06-24T10:00:00.000Z',
    },
  ],
  routing: 'auto_eligible',
  routing_reasons: [],
  line_items: [],
  quote: draftQuote,
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

function renderQuoteOutput() {
  return render(
    <PageHeaderProvider>
      <MemoryRouter initialEntries={['/requests/req-1/quote']}>
        <PageHeaderSlots />
        <Routes>
          <Route path="/requests/:id/quote" element={<QuoteOutput />} />
        </Routes>
      </MemoryRouter>
    </PageHeaderProvider>,
  );
}

describe('QuoteOutput', () => {
  beforeEach(() => {
    mockUseRequest.mockReset();
    mockUseApproveQuote.mockReset();
    mockApproveMutate.mockReset();
    mockDownloadQuotePdf.mockReset();
    mockUseClipboardCopy.mockReset();
    mockCopy.mockReset();

    mockUseApproveQuote.mockReturnValue({
      mutate: mockApproveMutate,
      isPending: false,
      isError: false,
      error: undefined,
    });
    mockUseClipboardCopy.mockReturnValue({ status: 'idle', copy: mockCopy });
  });

  it('pre-approval: shows the draft preview with Download PDF disabled and Approve & ready active', () => {
    mockUseRequest.mockReturnValue({
      data: requestFixture,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderQuoteOutput();

    expect(screen.getByRole('button', { name: /download pdf/i })).toBeDisabled();
    const approveButton = screen.getByRole('button', { name: /approve & ready/i });
    expect(approveButton).toBeEnabled();
    expect(approveButton.textContent?.toLowerCase()).not.toMatch(/send/);
  });

  it('calls approveQuote.mutate when Approve & ready is clicked', async () => {
    const user = userEvent.setup();
    mockUseRequest.mockReturnValue({
      data: requestFixture,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderQuoteOutput();
    await user.click(screen.getByRole('button', { name: /approve & ready/i }));

    expect(mockApproveMutate).toHaveBeenCalled();
  });

  it('transitions in place to the post-approval render once the request cache reflects a ready quote', () => {
    const readyRequest: RequestDetail = {
      ...requestFixture,
      quote: {
        ...draftQuote,
        status: 'ready',
        pdf_storage_url: 'https://cdn.example/q-2041.pdf',
        pdf_generated_at: '2026-07-01T00:00:00.000Z',
      },
    };
    mockUseRequest.mockReturnValue({
      data: readyRequest,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderQuoteOutput();

    expect(screen.getByRole('button', { name: /download pdf/i })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /approve & ready/i })).not.toBeInTheDocument();
    expect(screen.getByText(/this quote has been approved/i)).toBeInTheDocument();
  });

  it('fires the PDF fetch when Download PDF is clicked in the ready state', async () => {
    const user = userEvent.setup();
    const readyRequest: RequestDetail = {
      ...requestFixture,
      quote: { ...draftQuote, status: 'ready', pdf_storage_url: 'https://cdn.example/q.pdf' },
    };
    mockUseRequest.mockReturnValue({
      data: readyRequest,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockDownloadQuotePdf.mockResolvedValue(new Blob(['PDF'], { type: 'application/pdf' }));
    URL.createObjectURL = vi.fn(() => 'blob:fake-url');
    URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderQuoteOutput();
    await user.click(screen.getByRole('button', { name: /download pdf/i }));

    expect(mockDownloadQuotePdf).toHaveBeenCalledWith('req-1');
    clickSpy.mockRestore();
  });

  it('renders a 409 approve failure using the server message', () => {
    mockUseApproveQuote.mockReturnValue({
      mutate: mockApproveMutate,
      isPending: false,
      isError: true,
      error: { response: { status: 409, data: { message: 'Quote has not been priced yet.' } } },
    });
    mockUseRequest.mockReturnValue({
      data: requestFixture,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderQuoteOutput();

    expect(screen.getByText('Quote has not been priced yet.')).toBeInTheDocument();
  });

  it('renders a 424 approve failure using generic copy when the server sends no message', () => {
    mockUseApproveQuote.mockReturnValue({
      mutate: mockApproveMutate,
      isPending: false,
      isError: true,
      error: { response: { status: 424, data: {} } },
    });
    mockUseRequest.mockReturnValue({
      data: requestFixture,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderQuoteOutput();

    expect(
      screen.getByText(/could not generate the quote pdf\. please try again\./i),
    ).toBeInTheDocument();
  });

  it('falls back to a client-side template when the server email draft is null', () => {
    mockUseRequest.mockReturnValue({
      data: requestFixture,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderQuoteOutput();

    expect(screen.getByLabelText('Subject')).toHaveValue('Your quote Q-2041 from Distill.ai');
  });

  it('renders the server-provided email draft when present', () => {
    mockUseRequest.mockReturnValue({
      data: {
        ...requestFixture,
        quote: {
          ...draftQuote,
          email_draft_subject: 'Your quote from Distill.ai',
          email_draft_body: 'Hi James, please find your quote attached.',
        },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderQuoteOutput();

    expect(screen.getByLabelText('Subject')).toHaveValue('Your quote from Distill.ai');
    expect(screen.getByLabelText('Message')).toHaveValue(
      'Hi James, please find your quote attached.',
    );
  });

  it('copies the combined subject and body when Copy to Clipboard is clicked', async () => {
    const user = userEvent.setup();
    mockUseRequest.mockReturnValue({
      data: requestFixture,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderQuoteOutput();
    await user.click(screen.getByRole('button', { name: /copy to clipboard/i }));

    expect(mockCopy).toHaveBeenCalledWith(
      'Your quote Q-2041 from Distill.ai\n\nHi,\n\nPlease find attached your quote Q-2041. The total is GBP 4,120.00. The estimated lead time is 7 business days.\n\nBest regards,\nDistill.ai',
      expect.anything(),
    );
  });
});
