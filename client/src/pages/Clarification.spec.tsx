import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Clarification } from './Clarification';
import { PageHeaderProvider, usePageHeader } from '../context/PageHeaderContext';
import type { RequestDetail } from '../api/requests';
import type { Clarification as ClarificationDetail } from '../api/clarification';

const {
  mockUseRequest,
  mockUseClarification,
  mockUseGenerateClarificationDraft,
  mockGenerateMutate,
  mockUseUpdateClarificationDraft,
  mockUpdateMutate,
  mockUseSendClarification,
  mockSendMutate,
} = vi.hoisted(() => ({
  mockUseRequest: vi.fn(),
  mockUseClarification: vi.fn(),
  mockUseGenerateClarificationDraft: vi.fn(),
  mockGenerateMutate: vi.fn(),
  mockUseUpdateClarificationDraft: vi.fn(),
  mockUpdateMutate: vi.fn(),
  mockUseSendClarification: vi.fn(),
  mockSendMutate: vi.fn(),
}));

vi.mock('../api/requests', () => ({
  useRequest: () => mockUseRequest(),
}));

vi.mock('../api/clarification', () => ({
  useClarification: () => mockUseClarification(),
  useGenerateClarificationDraft: () => mockUseGenerateClarificationDraft(),
  useUpdateClarificationDraft: () => mockUseUpdateClarificationDraft(),
  useSendClarification: () => mockUseSendClarification(),
}));

const requestFixture: RequestDetail = {
  id: 'req-1',
  sender_company: 'Vertex Logistics',
  sender_contact: 'Jordan Lee',
  sender_email: 'jordan@vertex.example',
  source_subject: 'RFQ: steel brackets',
  source_body: 'Hi, please quote steel brackets.',
  request_type: 'catalog_rfq',
  status: 'needs_clarification',
  overall_confidence: null,
  current_node: 'parse',
  created_at: '2026-06-24T10:00:00.000Z',
  attachments: [
    {
      id: 'att-1',
      filename: 'invoice.pdf',
      mime_type: 'application/pdf',
      size_bytes: 1000,
      parse_status: 'unparsed',
      parse_error_reason: 'no_text_layer',
      created_at: '2026-06-24T10:00:00.000Z',
    },
  ],
  routing: null,
  routing_reasons: [],
  line_items: [],
  quote: null,
};

const clarificationFixture: ClarificationDetail = {
  id: 'clar-1',
  request_id: 'req-1',
  gaps: ['invoice.pdf: This file contains only scanned images with no readable text.'],
  draft_subject: 'Quick questions on your request',
  draft_body: 'Hi Vertex Logistics team, could you resend invoice.pdf?',
  sent_at: null,
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

function renderClarification() {
  return render(
    <PageHeaderProvider>
      <MemoryRouter initialEntries={['/requests/req-1/clarification']}>
        <PageHeaderSlots />
        <Routes>
          <Route path="/requests/:id/clarification" element={<Clarification />} />
        </Routes>
      </MemoryRouter>
    </PageHeaderProvider>,
  );
}

describe('Clarification', () => {
  beforeEach(() => {
    mockUseRequest.mockReset();
    mockUseClarification.mockReset();
    mockGenerateMutate.mockReset();
    mockUpdateMutate.mockReset();
    mockSendMutate.mockReset();

    mockUseGenerateClarificationDraft.mockReset().mockReturnValue({
      mutate: mockGenerateMutate,
      isError: false,
      reset: vi.fn(),
    });
    mockUseUpdateClarificationDraft.mockReset().mockReturnValue({
      mutate: mockUpdateMutate,
      isPending: false,
    });
    mockUseSendClarification.mockReset().mockReturnValue({
      mutate: mockSendMutate,
      isPending: false,
    });
  });

  it('shows a loading state while the request loads', () => {
    mockUseRequest.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    mockUseClarification.mockReturnValue({ data: undefined, isLoading: false, isError: false });

    renderClarification();

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('offers a retry when the request fails to load', () => {
    const refetch = vi.fn();
    mockUseRequest.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
    mockUseClarification.mockReturnValue({ data: undefined, isLoading: false, isError: false });

    renderClarification();

    screen.getByRole('button', { name: /retry/i }).click();
    expect(refetch).toHaveBeenCalled();
  });

  it('auto-generates a draft from unparsed attachments when none exists yet (404)', () => {
    mockUseRequest.mockReturnValue({
      data: requestFixture,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseClarification.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { response: { status: 404 } },
    });

    renderClarification();

    expect(screen.getByText(/drafting a clarification email/i)).toBeInTheDocument();
    expect(mockGenerateMutate).toHaveBeenCalledWith({
      requestId: 'req-1',
      gaps: ['invoice.pdf: This file contains only scanned images with no readable text.'],
    });
  });

  it('renders the blocking items and the draft email once a clarification exists', () => {
    mockUseRequest.mockReturnValue({
      data: requestFixture,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseClarification.mockReturnValue({
      data: clarificationFixture,
      isLoading: false,
      isError: false,
    });

    renderClarification();

    expect(
      screen.getByRole('heading', { name: /clarification · vertex logistics/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'invoice.pdf: This file contains only scanned images with no readable text.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Subject')).toHaveValue('Quick questions on your request');
    expect(screen.getByLabelText('Subject')).toHaveAttribute('readOnly');
  });

  it('edit flow: Edit makes fields editable, Save persists the edited values', async () => {
    const user = userEvent.setup();
    mockUseRequest.mockReturnValue({
      data: requestFixture,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseClarification.mockReturnValue({
      data: clarificationFixture,
      isLoading: false,
      isError: false,
    });

    renderClarification();

    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    expect(screen.getByLabelText('Subject')).not.toHaveAttribute('readOnly');

    await user.clear(screen.getByLabelText('Subject'));
    await user.type(screen.getByLabelText('Subject'), 'Updated subject');

    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(mockUpdateMutate).toHaveBeenCalledWith(
      {
        id: 'clar-1',
        draft_subject: 'Updated subject',
        draft_body: clarificationFixture.draft_body,
      },
      expect.any(Object),
    );
  });

  it('edit flow: shows an error and stays in edit mode when saving fails', async () => {
    const user = userEvent.setup();
    mockUseRequest.mockReturnValue({
      data: requestFixture,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseClarification.mockReturnValue({
      data: clarificationFixture,
      isLoading: false,
      isError: false,
    });
    mockUpdateMutate.mockImplementation((_payload: unknown, { onError }: { onError: () => void }) =>
      onError(),
    );

    renderClarification();

    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(screen.getByText(/could not save the draft/i)).toBeInTheDocument();
    // Stays in edit mode so the user doesn't lose their in-progress edits.
    expect(screen.getByLabelText('Subject')).not.toHaveAttribute('readOnly');
  });

  it('send flow: Mark as sent calls sendClarification with the clarification id', async () => {
    const user = userEvent.setup();
    mockUseRequest.mockReturnValue({
      data: requestFixture,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseClarification.mockReturnValue({
      data: clarificationFixture,
      isLoading: false,
      isError: false,
    });

    renderClarification();

    await user.click(screen.getByRole('button', { name: /mark as sent/i }));

    expect(mockSendMutate).toHaveBeenCalledWith('clar-1', expect.any(Object));
  });

  it('send flow: shows an error when marking as sent fails', async () => {
    const user = userEvent.setup();
    mockUseRequest.mockReturnValue({
      data: requestFixture,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseClarification.mockReturnValue({
      data: clarificationFixture,
      isLoading: false,
      isError: false,
    });
    mockSendMutate.mockImplementation((_id: string, { onError }: { onError: () => void }) =>
      onError(),
    );

    renderClarification();

    await user.click(screen.getByRole('button', { name: /mark as sent/i }));

    expect(screen.getByText(/could not mark this clarification as sent/i)).toBeInTheDocument();
  });

  it('shows a sent notice instead of action buttons once sent_at is set', () => {
    mockUseRequest.mockReturnValue({
      data: requestFixture,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseClarification.mockReturnValue({
      data: { ...clarificationFixture, sent_at: '2026-07-01T00:00:00.000Z' },
      isLoading: false,
      isError: false,
    });

    renderClarification();

    expect(screen.getByText(/this clarification has been sent/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mark as sent/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument();
  });

  it('shows a retry when draft generation fails', () => {
    mockUseRequest.mockReturnValue({
      data: requestFixture,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseClarification.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { response: { status: 404 } },
    });
    const reset = vi.fn();
    mockUseGenerateClarificationDraft.mockReturnValue({
      mutate: mockGenerateMutate,
      isError: true,
      reset,
    });

    renderClarification();

    expect(screen.getByText(/could not draft a clarification email/i)).toBeInTheDocument();
    screen.getByRole('button', { name: /retry/i }).click();
    expect(reset).toHaveBeenCalled();
  });
});
