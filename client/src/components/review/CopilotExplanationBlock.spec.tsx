import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CopilotExplanationBlock } from './CopilotExplanationBlock';

const explanation =
  'Routed to needs review because the deal value exceeds the auto-send cap for this account.';

describe('CopilotExplanationBlock', () => {
  it('shows a pending indicator while loading', () => {
    const { container } = render(
      <CopilotExplanationBlock explanation={undefined} isLoading isError={false} />,
    );
    expect(screen.getByText('Why this needs review')).toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders nothing on error', () => {
    const { container } = render(
      <CopilotExplanationBlock explanation={undefined} isLoading={false} isError />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the explanation is an empty string (EC-02)', () => {
    const { container } = render(
      <CopilotExplanationBlock explanation="" isLoading={false} isError={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the badge and explanation text when populated', () => {
    render(<CopilotExplanationBlock explanation={explanation} isLoading={false} isError={false} />);
    expect(screen.getByText('AI explanation')).toBeInTheDocument();
    expect(screen.getByText(explanation)).toBeInTheDocument();
  });

  it('toggles the panel open and closed', async () => {
    const user = userEvent.setup();
    render(<CopilotExplanationBlock explanation={explanation} isLoading={false} isError={false} />);

    const btn = screen.getByRole('button', { name: /why this needs review/i });
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(explanation)).toBeVisible();

    await user.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText(explanation)).not.toBeVisible();

    await user.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(explanation)).toBeVisible();
  });

  it('shows a degraded note when the explanation is a template fallback', () => {
    render(
      <CopilotExplanationBlock
        explanation={explanation}
        isLoading={false}
        isError={false}
        degraded
      />,
    );
    expect(screen.getByText(/auto-generated, may be less precise/i)).toBeInTheDocument();
  });

  it('does not show a degraded note for a normal LLM explanation', () => {
    render(
      <CopilotExplanationBlock
        explanation={explanation}
        isLoading={false}
        isError={false}
        degraded={false}
      />,
    );
    expect(screen.queryByText(/auto-generated, may be less precise/i)).not.toBeInTheDocument();
  });
});
