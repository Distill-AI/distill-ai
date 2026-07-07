import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AxiosError } from 'axios';
import { AskCopilotPanel } from './AskCopilotPanel';
import { GENERIC_ERROR } from '../../lib/errorMessages';
import type { AskCopilotResponse } from '../../api/interface/ask-copilot';

const { mockMutate, mockReset, state } = vi.hoisted(() => ({
  mockMutate: vi.fn(),
  mockReset: vi.fn(),
  state: {
    isPending: false,
    isError: false,
    error: null as AxiosError<{ message?: string }> | null,
    data: undefined as AskCopilotResponse | undefined,
  },
}));

vi.mock('../../api/askCopilot', () => ({
  useAskCopilot: () => ({
    mutate: mockMutate,
    isPending: state.isPending,
    isError: state.isError,
    error: state.error,
    data: state.data,
    reset: mockReset,
  }),
}));

function resetState() {
  state.isPending = false;
  state.isError = false;
  state.error = null;
  state.data = undefined;
}

describe('AskCopilotPanel', () => {
  beforeEach(() => {
    mockMutate.mockReset();
    mockReset.mockReset();
    resetState();
  });

  it('renders collapsed by default with the Ask Copilot trigger and Agentic badge', () => {
    render(<AskCopilotPanel requestId="req-1" />);

    expect(screen.getByText('Ask Copilot')).toBeInTheDocument();
    expect(screen.getByText('Agentic')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ask copilot/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('keeps the Ask button disabled until a question is typed', async () => {
    const user = userEvent.setup();
    render(<AskCopilotPanel requestId="req-1" />);
    await user.click(screen.getByRole('button', { name: /ask copilot/i }));

    const askButton = screen.getByRole('button', { name: 'Ask' });
    expect(askButton).toBeDisabled();

    await user.type(screen.getByPlaceholderText(/why is this line item flagged/i), 'why?');
    expect(askButton).toBeEnabled();
  });

  it('calls mutate with the typed question on submit', async () => {
    const user = userEvent.setup();
    render(<AskCopilotPanel requestId="req-1" />);
    await user.click(screen.getByRole('button', { name: /ask copilot/i }));

    await user.type(
      screen.getByPlaceholderText(/why is this line item flagged/i),
      'why is this flagged?',
    );
    await user.click(screen.getByRole('button', { name: 'Ask' }));

    expect(mockMutate).toHaveBeenCalledWith('why is this flagged?');
  });

  it('disables the input and button and shows a loading indicator while pending', async () => {
    state.isPending = true;
    const user = userEvent.setup();
    const { container } = render(<AskCopilotPanel requestId="req-1" />);
    await user.click(screen.getByRole('button', { name: /ask copilot/i }));

    expect(screen.getByPlaceholderText(/why is this line item flagged/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled();
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders the answer and a badged trace step on success', async () => {
    state.data = {
      answer: 'This needs review because confidence is below threshold.',
      trace: [
        {
          thought: 'Checking routing.',
          tool: 'explain_routing',
          input: {},
          output: { degraded: false },
        },
        { thought: 'Final answer reached.', tool: null, input: null, output: null },
      ],
    };
    const user = userEvent.setup();
    render(<AskCopilotPanel requestId="req-1" />);
    await user.click(screen.getByRole('button', { name: /ask copilot/i }));

    expect(
      screen.getByText('This needs review because confidence is below threshold.'),
    ).toBeInTheDocument();
    expect(screen.getByText('explain_routing')).toBeInTheDocument();
    expect(screen.getByText('Checking routing.')).toBeInTheDocument();
    expect(screen.getByText('Final answer reached.')).toBeInTheDocument();
  });

  it('resets stale results when editing the question after a successful answer', async () => {
    state.data = {
      answer: 'This needs review because confidence is below threshold.',
      trace: [],
    };
    const user = userEvent.setup();
    render(<AskCopilotPanel requestId="req-1" />);
    await user.click(screen.getByRole('button', { name: /ask copilot/i }));

    await user.type(screen.getByPlaceholderText(/why is this line item flagged/i), 'x');

    expect(mockReset).toHaveBeenCalled();
  });

  it('resets a stale error when editing the question after a failed request', async () => {
    state.isError = true;
    state.error = { response: { data: { message: 'boom' } } } as AxiosError<{ message?: string }>;
    const user = userEvent.setup();
    render(<AskCopilotPanel requestId="req-1" />);
    await user.click(screen.getByRole('button', { name: /ask copilot/i }));

    await user.type(screen.getByPlaceholderText(/why is this line item flagged/i), 'x');

    expect(mockReset).toHaveBeenCalled();
  });

  it('shows the server error message when the request fails', async () => {
    state.isError = true;
    state.error = {
      response: { data: { message: 'Copilot Q&A is not enabled for this environment' } },
    } as AxiosError<{ message?: string }>;
    const user = userEvent.setup();
    render(<AskCopilotPanel requestId="req-1" />);
    await user.click(screen.getByRole('button', { name: /ask copilot/i }));

    expect(screen.getByText('Copilot Q&A is not enabled for this environment')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the server sends none', async () => {
    state.isError = true;
    state.error = { response: undefined } as AxiosError<{ message?: string }>;
    const user = userEvent.setup();
    render(<AskCopilotPanel requestId="req-1" />);
    await user.click(screen.getByRole('button', { name: /ask copilot/i }));

    expect(screen.getByText(GENERIC_ERROR)).toBeInTheDocument();
  });
});
