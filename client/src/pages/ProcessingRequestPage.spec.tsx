import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProcessingRequestPage } from './ProcessingRequestPage';
import { PageHeaderProvider } from '../context/PageHeaderContext';
import type { RequestDetail } from '../api/requests';

const { mockUseRequest, mockUseSSEEvents } = vi.hoisted(() => ({
  mockUseRequest: vi.fn(),
  mockUseSSEEvents: vi.fn(),
}));

vi.mock('../api/requests', () => ({
  useRequest: () => mockUseRequest(),
}));
vi.mock('../hooks/useSSEEvents', () => ({
  useSSEEvents: () => mockUseSSEEvents(),
}));

const sseState = {
  nodes: [{ id: 'parse', name: 'parse', status: 'success' as const }],
  connection: { status: 'connected' as const },
  finalOutput: null,
  reconnect: vi.fn(),
};

const detail: RequestDetail = {
  id: 'req-1',
  sender_company: 'Apex Fabrication',
  sender_contact: 'Dana Reyes',
  sender_email: 'dana@apex.example',
  sender_address: null,
  source_subject: 'RFQ: 200x steel brackets',
  source_body: 'Hi, please quote 200 steel brackets.',
  request_type: 'catalog_rfq',
  status: 'needs_review',
  overall_confidence: 0.91,
  current_node: 'match',
  created_at: '2026-06-24T10:00:00.000Z',
  routing: 'needs_review',
  routing_reasons: [],
  attachments: [],
  line_items: [
    {
      id: 'li-1',
      position: 1,
      raw_text: '200x steel brackets',
      quantity: 200,
      unit_price_minor: 1425,
      match_confidence: 0.91,
      matched_sku: { id: 'sku-1', sku_code: 'SKU-061', name: 'Steel Bracket' },
      flags: [],
    },
  ],
  quote: null,
};

function renderPage() {
  return render(
    <PageHeaderProvider>
      <MemoryRouter initialEntries={['/requests/req-1/processing']}>
        <Routes>
          <Route path="/requests/:id/processing" element={<ProcessingRequestPage />} />
        </Routes>
      </MemoryRouter>
    </PageHeaderProvider>,
  );
}

describe('ProcessingRequestPage', () => {
  beforeEach(() => {
    mockUseRequest.mockReset();
    mockUseSSEEvents.mockReset();
    mockUseSSEEvents.mockReturnValue(sseState);
  });

  it('renders Matched Lines with the mapped raw text when line_items is non-empty', () => {
    mockUseRequest.mockReturnValue({ data: detail, isLoading: false, isError: false });
    renderPage();

    expect(screen.getByText(/matched lines/i)).toBeInTheDocument();
    expect(screen.getByText('200x steel brackets')).toBeInTheDocument();
  });

  it('does not render Matched Lines when line_items is empty', () => {
    mockUseRequest.mockReturnValue({
      data: { ...detail, line_items: [] },
      isLoading: false,
      isError: false,
    });
    renderPage();

    expect(screen.queryByText(/matched lines/i)).not.toBeInTheDocument();
  });

  it('shows the md confidence tier for a 0.91 line, matching DEFAULT_THRESHOLDS', () => {
    mockUseRequest.mockReturnValue({ data: detail, isLoading: false, isError: false });
    renderPage();

    const pct = screen.getByText('91%');
    expect(pct.parentElement?.className).toContain('bg-md-bg');
    expect(pct.parentElement?.className).not.toContain('bg-hi-bg');
  });
});
