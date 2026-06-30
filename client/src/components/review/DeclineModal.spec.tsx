import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { createRef } from 'react';
import type { AxiosError } from 'axios';
import { DeclineModal } from './DeclineModal';

type MutateCallbacks = {
  onSuccess?: () => void;
  onError?: (err: AxiosError<{ message?: string }>) => void;
};

const { mockMutate, mockIsPending, capturedCallbacks } = vi.hoisted(() => ({
  mockMutate: vi.fn(),
  mockIsPending: { value: false },
  capturedCallbacks: { current: null as MutateCallbacks | null },
}));

vi.mock('../../api/requests', () => ({
  useDeclineRequest: () => ({
    mutate: (data: unknown, callbacks?: MutateCallbacks) => {
      capturedCallbacks.current = callbacks ?? null;
      mockMutate(data);
    },
    isPending: mockIsPending.value,
    reset: vi.fn(),
  }),
}));

function renderModal(open = true) {
  const onClose = vi.fn();
  const triggerRef = createRef<HTMLButtonElement>();

  render(
    <MemoryRouter>
      <DeclineModal
        requestId="req-1"
        open={open}
        onClose={onClose}
        triggerRef={triggerRef}
      />
    </MemoryRouter>,
  );

  return { onClose, triggerRef };
}

describe('DeclineModal', () => {
  beforeEach(() => {
    mockMutate.mockReset();
    mockIsPending.value = false;
    capturedCallbacks.current = null;
  });

  it('does not render when open is false', () => {
    renderModal(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders heading and reason picker when open', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/decline request/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/decline reason/i)).toBeInTheDocument();
  });

  it('Confirm is disabled before a reason is selected', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /confirm decline/i })).toBeDisabled();
  });

  it('shows custom reason input when Other is selected', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.selectOptions(screen.getByLabelText(/decline reason/i), 'Other');

    expect(screen.getByLabelText(/custom decline reason/i)).toBeInTheDocument();
  });

  it('Confirm stays disabled when Other is selected but custom text is empty', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.selectOptions(screen.getByLabelText(/decline reason/i), 'Other');

    expect(screen.getByRole('button', { name: /confirm decline/i })).toBeDisabled();
  });

  it('calls mutate with the selected reason and closes on success', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.selectOptions(
      screen.getByLabelText(/decline reason/i),
      'Not a relevant request',
    );
    await user.click(screen.getByRole('button', { name: /confirm decline/i }));

    expect(mockMutate).toHaveBeenCalledWith({
      requestId: 'req-1',
      reason: 'Not a relevant request',
    });

    act(() => {
      capturedCallbacks.current?.onSuccess?.();
    });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows server error message on 4xx', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.selectOptions(
      screen.getByLabelText(/decline reason/i),
      'Not a relevant request',
    );
    await user.click(screen.getByRole('button', { name: /confirm decline/i }));

    act(() => {
      capturedCallbacks.current?.onError?.({
        response: { status: 422, data: { message: 'Request already processed.' } },
      } as AxiosError<{ message?: string }>);
    });

    expect(screen.getByText('Request already processed.')).toBeInTheDocument();
  });

  it('shows generic error on 5xx', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.selectOptions(
      screen.getByLabelText(/decline reason/i),
      'Not a relevant request',
    );
    await user.click(screen.getByRole('button', { name: /confirm decline/i }));

    act(() => {
      capturedCallbacks.current?.onError?.({
        response: { status: 500, data: {} },
      } as AxiosError<{ message?: string }>);
    });

    expect(screen.getByText(/failed to decline/i)).toBeInTheDocument();
  });

  it('Escape key calls onClose', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('focus moves into the dialog on open', () => {
    renderModal();
    expect(screen.getByLabelText(/decline reason/i)).toHaveFocus();
  });
});
