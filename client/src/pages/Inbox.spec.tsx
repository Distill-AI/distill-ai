import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { RoleProvider } from '../context/RoleContext';
import { Inbox } from './Inbox';

import type { RequestSummary } from '../api/requests';

const { mockMutateAsync, mockIsPending, capturedOnError, requestsState } = vi.hoisted(() => ({
  mockMutateAsync: vi.fn(),
  mockIsPending: { value: false },
  capturedOnError: { current: null as ((msg: string) => void) | null },
  requestsState: {
    value: { data: [] as RequestSummary[], isLoading: false, isError: false },
  },
}));

vi.mock('../api/requests', () => ({
  useCreateRequest: (onError: (msg: string) => void) => {
    capturedOnError.current = onError;
    return {
      mutateAsync: mockMutateAsync,
      isPending: mockIsPending.value,
    };
  },
  useRequests: () => requestsState.value,
}));

function makeRequest(overrides: Partial<RequestSummary> = {}): RequestSummary {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    sender_company: 'Apex Fabrication',
    sender_contact: 'Dana Reyes',
    source_subject: 'RFQ for steel brackets',
    request_type: 'catalog_rfq',
    overall_confidence: 0.96,
    status: 'needs_review',
    created_at: '2026-06-24T10:00:00.000Z',
    ...overrides,
  };
}

function renderInbox() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RoleProvider>
          <Inbox />
        </RoleProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Inbox', () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
    mockIsPending.value = false;
    requestsState.value = { data: [], isLoading: false, isError: false };
  });

  it('opens the new request dialog when clicking + New request', async () => {
    const user = userEvent.setup();
    renderInbox();

    await user.click(screen.getByRole('button', { name: /\+ new request/i }));

    expect(screen.getByRole('dialog', { name: /new request/i })).toBeInTheDocument();
  });

  it('closes the dialog on Escape', async () => {
    const user = userEvent.setup();
    renderInbox();

    const trigger = screen.getByRole('button', { name: /\+ new request/i });
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('shows the email textarea when Paste email tab is selected', async () => {
    const user = userEvent.setup();
    renderInbox();

    await user.click(screen.getByRole('button', { name: /\+ new request/i }));
    await user.click(screen.getByRole('tab', { name: /paste email/i }));

    expect(screen.getByLabelText(/email body/i)).toBeInTheDocument();
  });

  it('disables Process request until files are added on the upload tab', async () => {
    const user = userEvent.setup();
    const { container } = renderInbox();

    await user.click(screen.getByRole('button', { name: /\+ new request/i }));

    const processButton = screen.getByRole('button', { name: /process request/i });
    expect(processButton).toBeDisabled();

    const file = new File(['sample'], 'rfq_apex.pdf', { type: 'application/pdf' });
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    expect(processButton).toBeEnabled();
    expect(screen.getByText(/rfq_apex\.pdf/i)).toBeInTheDocument();
  });

  it('removes a file chip when remove is clicked', async () => {
    const user = userEvent.setup();
    const { container } = renderInbox();

    await user.click(screen.getByRole('button', { name: /\+ new request/i }));

    const file = new File(['sample'], 'line_items.csv', { type: 'text/csv' });
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    expect(screen.getByText(/line_items\.csv/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /remove line_items\.csv/i }));
    expect(screen.queryByText(/line_items\.csv/i)).not.toBeInTheDocument();
  });

  // AC-01: button disabled when email tab is active and textarea is empty
  it('disables Process request when Paste email tab is active and textarea is empty', async () => {
    const user = userEvent.setup();
    renderInbox();

    await user.click(screen.getByRole('button', { name: /\+ new request/i }));
    await user.click(screen.getByRole('tab', { name: /paste email/i }));

    expect(screen.getByRole('button', { name: /process request/i })).toBeDisabled();
  });

  // AC-02: button disabled when textarea contains only whitespace
  it('disables Process request when Paste email tab is active and textarea contains only whitespace', async () => {
    const user = userEvent.setup();
    renderInbox();

    await user.click(screen.getByRole('button', { name: /\+ new request/i }));
    await user.click(screen.getByRole('tab', { name: /paste email/i }));
    await user.type(screen.getByLabelText(/email body/i), '   ');

    expect(screen.getByRole('button', { name: /process request/i })).toBeDisabled();
  });

  // AC-03: button enabled when textarea has non-empty content
  it('enables Process request when Paste email tab is active and textarea has content', async () => {
    const user = userEvent.setup();
    renderInbox();

    await user.click(screen.getByRole('button', { name: /\+ new request/i }));
    await user.click(screen.getByRole('tab', { name: /paste email/i }));
    await user.type(screen.getByLabelText(/email body/i), 'Hello, please quote this.');

    expect(screen.getByRole('button', { name: /process request/i })).toBeEnabled();
  });

  // AC-04: clicking Process request calls mutateAsync with trimmed body
  it('calls mutateAsync with kind:paste and trimmed body when Process request is clicked in paste mode', async () => {
    const user = userEvent.setup();
    renderInbox();

    await user.click(screen.getByRole('button', { name: /\+ new request/i }));
    await user.click(screen.getByRole('tab', { name: /paste email/i }));
    await user.type(screen.getByLabelText(/email body/i), '  pasted email body  ');
    await user.click(screen.getByRole('button', { name: /process request/i }));

    expect(mockMutateAsync).toHaveBeenCalledOnce();
    expect(mockMutateAsync).toHaveBeenCalledWith({
      kind: 'paste',
      sourceBody: 'pasted email body',
    });
  });

  // AC-05: button disabled while mutation is in flight
  it('disables Process request while the mutation is pending', async () => {
    mockIsPending.value = true;
    const user = userEvent.setup();
    renderInbox();

    await user.click(screen.getByRole('button', { name: /\+ new request/i }));
    await user.click(screen.getByRole('tab', { name: /paste email/i }));
    await user.type(screen.getByLabelText(/email body/i), 'Hello');

    expect(screen.getByRole('button', { name: /processing\.\.\./i })).toBeDisabled();
  });

  // AC-09: inline error appears and modal stays open when onError callback fires
  it('shows inline error from server when submit fails; dialog stays open', async () => {
    mockMutateAsync.mockRejectedValue(new Error('network'));
    const user = userEvent.setup();
    renderInbox();

    await user.click(screen.getByRole('button', { name: /\+ new request/i }));
    await user.click(screen.getByRole('tab', { name: /paste email/i }));
    await user.type(screen.getByLabelText(/email body/i), 'email content');
    await user.click(screen.getByRole('button', { name: /process request/i }));

    act(() => {
      capturedOnError.current?.('Request failed: invalid data');
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Request failed: invalid data');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  // AC-10: switching tabs preserves textarea content; guard re-evaluates on return
  it('preserves textarea content when switching tabs and re-enables Process request on return', async () => {
    const user = userEvent.setup();
    renderInbox();

    await user.click(screen.getByRole('button', { name: /\+ new request/i }));
    await user.click(screen.getByRole('tab', { name: /paste email/i }));
    await user.type(screen.getByLabelText(/email body/i), 'hello world');

    await user.click(screen.getByRole('tab', { name: /upload files/i }));
    expect(screen.getByRole('button', { name: /process request/i })).toBeDisabled();

    await user.click(screen.getByRole('tab', { name: /paste email/i }));
    expect(screen.getByLabelText(/email body/i)).toHaveValue('hello world');
    expect(screen.getByRole('button', { name: /process request/i })).toBeEnabled();
  });

  it('shows the empty state when there are no requests', () => {
    renderInbox();
    expect(screen.getByText(/no requests yet/i)).toBeInTheDocument();
  });

  it('shows the loading state while requests are loading', () => {
    requestsState.value = { data: [], isLoading: true, isError: false };
    renderInbox();
    expect(screen.getByText(/loading requests/i)).toBeInTheDocument();
  });

  it('shows the error state when the list fails to load', () => {
    requestsState.value = { data: [], isLoading: false, isError: true };
    renderInbox();
    expect(screen.getByText(/could not load requests/i)).toBeInTheDocument();
  });

  it('renders a row with company, subject and status badge', () => {
    // status 'sent' has no matching tab, so its label is unambiguous in the DOM
    requestsState.value = {
      data: [makeRequest({ status: 'sent' })],
      isLoading: false,
      isError: false,
    };
    renderInbox();

    expect(screen.getByRole('link', { name: /apex fabrication/i })).toBeInTheDocument();
    expect(screen.getByText(/rfq for steel brackets/i)).toBeInTheDocument();
    expect(screen.getByText('Sent')).toBeInTheDocument();
  });

  it('links each row to its processing screen', () => {
    requestsState.value = {
      data: [makeRequest({ id: 'abc-id', sender_company: 'Apex' })],
      isLoading: false,
      isError: false,
    };
    renderInbox();

    expect(screen.getByRole('link', { name: /apex/i })).toHaveAttribute('href', '/requests/abc-id');
  });

  it('filters rows by the active tab', async () => {
    const user = userEvent.setup();
    requestsState.value = {
      data: [
        makeRequest({ id: 'r1', sender_company: 'Review Co', status: 'needs_review' }),
        makeRequest({ id: 'r2', sender_company: 'Ready Co', status: 'ready' }),
      ],
      isLoading: false,
      isError: false,
    };
    renderInbox();

    expect(screen.getByText('Review Co')).toBeInTheDocument();
    expect(screen.getByText('Ready Co')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /^ready$/i }));

    expect(screen.queryByText('Review Co')).not.toBeInTheDocument();
    expect(screen.getByText('Ready Co')).toBeInTheDocument();
  });

  it('filters rows by the search query', async () => {
    const user = userEvent.setup();
    requestsState.value = {
      data: [
        makeRequest({ id: 'r1', sender_company: 'Apex Fabrication' }),
        makeRequest({ id: 'r2', sender_company: 'Globex Industries' }),
      ],
      isLoading: false,
      isError: false,
    };
    renderInbox();

    await user.type(screen.getByRole('searchbox', { name: /search requests/i }), 'globex');

    expect(screen.queryByText('Apex Fabrication')).not.toBeInTheDocument();
    expect(screen.getByText('Globex Industries')).toBeInTheDocument();
  });
});
