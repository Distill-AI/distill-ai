import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OriginalAttachmentCard } from './OriginalAttachmentCard';
import type { AttachmentSummary } from '../../api/requests';

const { mockDownload } = vi.hoisted(() => ({ mockDownload: vi.fn() }));

vi.mock('../../api/attachments', () => ({
  downloadAttachment: mockDownload,
}));

const attachment: AttachmentSummary = {
  id: 'att-1',
  filename: 'rfq_apex.pdf',
  mime_type: 'application/pdf',
  size_bytes: 1258291,
  created_at: '2026-06-24T10:00:00.000Z',
};

describe('OriginalAttachmentCard', () => {
  beforeEach(() => mockDownload.mockReset());

  it('shows the filename, a readable type label and the size', () => {
    render(<OriginalAttachmentCard requestId="req-1" attachment={attachment} />);

    expect(screen.getByText('rfq_apex.pdf')).toBeInTheDocument();
    expect(screen.getByText(/PDF Document/)).toBeInTheDocument();
    expect(screen.getByText(/1\.2 MB/)).toBeInTheDocument();
  });

  it('downloads the original attachment when the button is clicked', async () => {
    mockDownload.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<OriginalAttachmentCard requestId="req-1" attachment={attachment} />);

    await user.click(screen.getByRole('button', { name: /download rfq_apex\.pdf/i }));

    expect(mockDownload).toHaveBeenCalledWith('req-1', 'att-1', 'rfq_apex.pdf');
  });
});
