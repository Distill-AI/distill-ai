import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { RoleProvider } from '../context/RoleContext';
import { Inbox } from './Inbox';

const { mockMutate, mockIsPending, capturedOnError } = vi.hoisted(() => ({
  mockMutate: vi.fn(),
  mockIsPending: { value: false },
  capturedOnError: { current: null as ((msg: string) => void) | null },
}));

vi.mock('../api/requests', () => ({
  useCreateRequest: (onError: (msg: string) => void) => {
    capturedOnError.current = onError;
    return {
      mutate: mockMutate,
      isPending: mockIsPending.value,
      reset: vi.fn(),
    };
  },
}));

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
    mockMutate.mockClear();
    mockIsPending.value = false;
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

  // AC-04: clicking Process request calls mutate with trimmed body
  it('calls mutate with channel and trimmed body when Process request is clicked in paste mode', async () => {
    const user = userEvent.setup();
    renderInbox();

    await user.click(screen.getByRole('button', { name: /\+ new request/i }));
    await user.click(screen.getByRole('tab', { name: /paste email/i }));
    await user.type(screen.getByLabelText(/email body/i), '  pasted email body  ');
    await user.click(screen.getByRole('button', { name: /process request/i }));

    expect(mockMutate).toHaveBeenCalledOnce();
    expect(mockMutate).toHaveBeenCalledWith(
      { kind: 'paste', sourceBody: 'pasted email body' },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  // AC-05: button disabled while mutation is in flight
  it('disables Process request while the mutation is pending', async () => {
    mockIsPending.value = true;
    const user = userEvent.setup();
    renderInbox();

    await user.click(screen.getByRole('button', { name: /\+ new request/i }));
    await user.click(screen.getByRole('tab', { name: /paste email/i }));
    await user.type(screen.getByLabelText(/email body/i), 'Hello');

    expect(screen.getByRole('button', { name: /process request/i })).toBeDisabled();
  });

  // AC-09: inline error appears and modal stays open when mutate fires onError
  it('shows inline error from server when submit fails; dialog stays open', async () => {
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
});
