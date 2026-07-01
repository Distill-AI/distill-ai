import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmailDraftPanel } from './EmailDraftPanel';

describe('EmailDraftPanel', () => {
  it('omits the To field when the `to` prop is not provided', () => {
    render(
      <EmailDraftPanel
        subject="Quick questions"
        body="Hi there"
        trailingActions={<button>Send</button>}
      />,
    );
    expect(screen.queryByLabelText('To')).not.toBeInTheDocument();
  });

  it('renders the To field as read-only when provided', () => {
    render(
      <EmailDraftPanel
        to="dana@apex.example"
        subject="Quick questions"
        body="Hi there"
        trailingActions={<button>Send</button>}
      />,
    );
    const toField = screen.getByLabelText('To');
    expect(toField).toHaveValue('dana@apex.example');
    expect(toField).toHaveAttribute('readOnly');
  });

  it('renders the subject and body values', () => {
    render(
      <EmailDraftPanel
        subject="Quick questions on your request"
        body="Hi Vertex Logistics team,"
        trailingActions={<button>Send</button>}
      />,
    );
    expect(screen.getByLabelText('Subject')).toHaveValue('Quick questions on your request');
    expect(screen.getByLabelText('Message')).toHaveValue('Hi Vertex Logistics team,');
  });

  it('calls onSubjectChange and onBodyChange as the user types, when editable', async () => {
    const user = userEvent.setup();
    const onSubjectChange = vi.fn();
    const onBodyChange = vi.fn();
    render(
      <EmailDraftPanel
        subject="Subject"
        body="Body"
        onSubjectChange={onSubjectChange}
        onBodyChange={onBodyChange}
        trailingActions={<button>Send</button>}
      />,
    );

    await user.type(screen.getByLabelText('Subject'), '!');
    await user.type(screen.getByLabelText('Message'), '!');

    expect(onSubjectChange).toHaveBeenCalled();
    expect(onBodyChange).toHaveBeenCalled();
  });

  it('marks subject and body read-only when readOnly is true', () => {
    render(
      <EmailDraftPanel
        subject="Subject"
        body="Body"
        readOnly
        trailingActions={<button>Send</button>}
      />,
    );

    expect(screen.getByLabelText('Subject')).toHaveAttribute('readOnly');
    expect(screen.getByLabelText('Message')).toHaveAttribute('readOnly');
  });

  it('renders the trailing actions slot', () => {
    render(
      <EmailDraftPanel
        subject="Subject"
        body="Body"
        trailingActions={<button>Copy to clipboard</button>}
      />,
    );

    expect(screen.getByRole('button', { name: 'Copy to clipboard' })).toBeInTheDocument();
  });
});
