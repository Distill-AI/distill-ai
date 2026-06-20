import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RoleProvider } from '../context/RoleContext';
import { Inbox } from './Inbox';

function renderInbox() {
  return render(
    <MemoryRouter>
      <RoleProvider>
        <Inbox />
      </RoleProvider>
    </MemoryRouter>,
  );
}

describe('Inbox', () => {
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
    renderInbox();

    await user.click(screen.getByRole('button', { name: /\+ new request/i }));

    const processButton = screen.getByRole('button', { name: /process request/i });
    expect(processButton).toBeDisabled();

    const file = new File(['sample'], 'rfq_apex.pdf', { type: 'application/pdf' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    expect(processButton).toBeEnabled();
    expect(screen.getByText(/rfq_apex\.pdf/i)).toBeInTheDocument();
  });

  it('removes a file chip when remove is clicked', async () => {
    const user = userEvent.setup();
    renderInbox();

    await user.click(screen.getByRole('button', { name: /\+ new request/i }));

    const file = new File(['sample'], 'line_items.csv', { type: 'text/csv' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    expect(screen.getByText(/line_items\.csv/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /remove line_items\.csv/i }));
    expect(screen.queryByText(/line_items\.csv/i)).not.toBeInTheDocument();
  });
});
