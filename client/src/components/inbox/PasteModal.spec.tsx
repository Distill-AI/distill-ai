import { createRef } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PasteModal } from './PasteModal';

const { mockMutate, mockIsPending } = vi.hoisted(() => ({
  mockMutate: vi.fn(),
  mockIsPending: { value: false },
}));

vi.mock('../../api/attachments', () => ({
  usePasteAttachment: () => ({
    mutate: mockMutate,
    isPending: mockIsPending.value,
  }),
}));

function renderModal(open = true) {
  const onClose = vi.fn();
  const triggerRef = createRef<HTMLButtonElement>();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PasteModal
        open={open}
        onClose={onClose}
        requestId="req-1"
        attachmentId="att-1"
        triggerRef={triggerRef}
      />
    </QueryClientProvider>,
  );
  return { onClose, triggerRef };
}

describe('PasteModal', () => {
  beforeEach(() => {
    mockMutate.mockReset();
    mockIsPending.value = false;
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <PasteModal
          open={false}
          onClose={vi.fn()}
          requestId="req-1"
          attachmentId="att-1"
          triggerRef={createRef()}
        />
      </QueryClientProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the dialog with the textarea when open', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/paste content/i)).toBeInTheDocument();
  });

  it('closes on Escape key', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls mutate with requestId, attachmentId, and content on submit', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText(/paste content/i), 'line items go here');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req-1',
        attachmentId: 'att-1',
        content: 'line items go here',
      }),
      expect.anything(),
    );
  });

  it('disables the submit button while isPending', () => {
    mockIsPending.value = true;
    renderModal();
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
  });

  it('shows a character count warning when fewer than 5000 characters remain', () => {
    renderModal();

    fireEvent.change(screen.getByLabelText(/paste content/i), {
      target: { value: 'a'.repeat(45_001) },
    });

    expect(screen.getByText(/characters remaining/i)).toBeInTheDocument();
  });

  it('shows an inline error when the mutation fails', async () => {
    const user = userEvent.setup();
    mockMutate.mockImplementation((_vars: unknown, opts: { onError: (e: Error) => void }) => {
      opts.onError(new Error('Server error'));
    });
    renderModal();

    await user.type(screen.getByLabelText(/paste content/i), 'some content');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('traps focus: Tab on last focusable element wraps to first', async () => {
    const user = userEvent.setup();
    renderModal();

    const buttons = screen.getAllByRole('button');
    const lastButton = buttons[buttons.length - 1];
    lastButton.focus();

    await user.tab();

    expect(document.activeElement).toBe(screen.getByRole('button', { name: /close/i }));
  });

  it('traps focus: Shift+Tab on first focusable element wraps to last', async () => {
    const user = userEvent.setup();
    renderModal();

    screen.getByRole('button', { name: /close/i }).focus();

    await user.tab({ shift: true });

    const buttons = screen.getAllByRole('button');
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
  });
});
