import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Review } from './Review';
import type { RequestDetail } from '../api/requests';

const { mockUseRequest, mockDownload } = vi.hoisted(() => ({
  mockUseRequest: vi.fn(),
  mockDownload: vi.fn(),
}));

vi.mock('../api/requests', () => ({
  useRequest: () => mockUseRequest(),
}));

vi.mock('../api/attachments', () => ({
  downloadAttachment: mockDownload,
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
  attachments: [
    {
      id: 'att-1',
      filename: 'rfq_apex.pdf',
      mime_type: 'application/pdf',
      size_bytes: 1258291,
      created_at: '2026-06-24T10:00:00.000Z',
    },
  ],
};

function renderReview() {
  return render(
    <MemoryRouter initialEntries={['/requests/req-1/review']}>
      <Routes>
        <Route path="/requests/:id/review" element={<Review />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Review', () => {
  beforeEach(() => {
    mockUseRequest.mockReset();
    mockDownload.mockReset();
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

  it('renders the parsed-structure and suggested-quote panes as placeholders', () => {
    mockUseRequest.mockReturnValue({ data: detail, isLoading: false, isError: false });
    renderReview();

    expect(screen.getByText(/parsed structure/i)).toBeInTheDocument();
    expect(screen.getByText(/suggested quote/i)).toBeInTheDocument();
    expect(screen.getAllByText(/coming soon/i)).toHaveLength(2);
  });
});
