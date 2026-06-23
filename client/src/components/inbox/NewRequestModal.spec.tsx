import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { NewRequestModal } from './NewRequestModal';
import { createRef } from 'react';

const { mockMutateAsync, mockIsPending, capturedOnError } = vi.hoisted(() => ({
  mockMutateAsync: vi.fn(),
  mockIsPending: { value: false },
  capturedOnError: { current: null as ((msg: string) => void) | null },
}));

vi.mock('../../api/requests', () => ({
  useCreateRequest: (onError: (msg: string) => void) => {
    capturedOnError.current = onError;
    return {
      mutateAsync: mockMutateAsync,
      isPending: mockIsPending.value,
    };
  },
}));

function renderModal(open = true) {
  const onClose = vi.fn();
  const triggerRef = createRef<HTMLButtonElement>();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <NewRequestModal open={open} onClose={onClose} triggerRef={triggerRef} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { onClose };
}

describe('NewRequestModal — submit wiring', () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
    mockIsPending.value = false;
    capturedOnError.current = null;
  });

  it('calls mutateAsync with kind:file payload when files are attached and Process request is clicked', async () => {
    mockMutateAsync.mockResolvedValue({
      request_id: 'a1b2c3d4-0000-0000-0000-000000000000',
      status: 'pending',
      current_node: '',
    });
    const user = userEvent.setup();
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <NewRequestModal open triggerRef={createRef()} onClose={vi.fn()} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const file = new File(['pdf'], 'rfq.pdf', { type: 'application/pdf' });
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);
    await user.click(screen.getByRole('button', { name: /process request/i }));

    expect(mockMutateAsync).toHaveBeenCalledOnce();
    expect(mockMutateAsync).toHaveBeenCalledWith({ kind: 'file', files: [file] });
  });

  it('calls mutateAsync with kind:paste payload when paste tab is active', async () => {
    mockMutateAsync.mockResolvedValue({
      request_id: 'a1b2c3d4-0000-0000-0000-000000000000',
      status: 'pending',
      current_node: '',
    });
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('tab', { name: /paste email/i }));
    await user.type(screen.getByLabelText(/email body/i), 'paste content');
    await user.click(screen.getByRole('button', { name: /process request/i }));

    expect(mockMutateAsync).toHaveBeenCalledWith({ kind: 'paste', sourceBody: 'paste content' });
  });

  it('shows "Processing..." and disables the button while isPending', async () => {
    mockIsPending.value = true;
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('tab', { name: /paste email/i }));
    await user.type(screen.getByLabelText(/email body/i), 'some content');

    expect(screen.getByRole('button', { name: /processing\.\.\./i })).toBeDisabled();
  });

  it('does not fire a second mutateAsync if the button is clicked while pending', async () => {
    mockIsPending.value = true;
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('tab', { name: /paste email/i }));
    await user.type(screen.getByLabelText(/email body/i), 'some content');

    const btn = screen.getByRole('button', { name: /processing\.\.\./i });
    await user.click(btn);
    await user.click(btn);

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('calls onClose after mutateAsync resolves successfully', async () => {
    mockMutateAsync.mockResolvedValue({
      request_id: 'a1b2c3d4-0000-0000-0000-000000000000',
      status: 'pending',
      current_node: '',
    });
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByRole('tab', { name: /paste email/i }));
    await user.type(screen.getByLabelText(/email body/i), 'email content');
    await user.click(screen.getByRole('button', { name: /process request/i }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does NOT call onClose when mutateAsync rejects', async () => {
    mockMutateAsync.mockRejectedValue(new Error('network'));
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByRole('tab', { name: /paste email/i }));
    await user.type(screen.getByLabelText(/email body/i), 'email content');
    await user.click(screen.getByRole('button', { name: /process request/i }));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows the banner error and keeps the dialog open when onError callback fires', async () => {
    mockMutateAsync.mockRejectedValue(new Error('network'));
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('tab', { name: /paste email/i }));
    await user.type(screen.getByLabelText(/email body/i), 'email content');
    await user.click(screen.getByRole('button', { name: /process request/i }));

    act(() => {
      capturedOnError.current?.('Something went wrong. Please try again.');
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
