import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AttachmentPanel } from './AttachmentPanel';

type ParseStatus = 'parsed' | 'unparsed' | 'manual_paste';
type ParseErrorReason =
  | 'corrupt'
  | 'no_text_layer'
  | 'unsupported_format'
  | 'size_limit_exceeded'
  | 'unknown';

const REASON_LABELS: Record<ParseErrorReason, string> = {
  corrupt: 'This file appears to be password-protected or corrupt.',
  no_text_layer: 'This file contains only scanned images with no readable text.',
  unsupported_format: 'This file format is not supported.',
  size_limit_exceeded: 'This file exceeds the maximum allowed size.',
  unknown: 'This file could not be read.',
};

function renderPanel(
  parseStatus: ParseStatus,
  parseErrorReason?: ParseErrorReason,
  isModalOpen = false,
) {
  const onPasteClick = vi.fn();
  render(
    <AttachmentPanel
      filename="rfq.pdf"
      parseStatus={parseStatus}
      parseErrorReason={parseErrorReason}
      isModalOpen={isModalOpen}
      onPasteClick={onPasteClick}
    />,
  );
  return { onPasteClick };
}

describe('AttachmentPanel', () => {
  it('renders nothing when parseStatus is "parsed"', () => {
    const { container } = render(
      <AttachmentPanel filename="rfq.pdf" parseStatus="parsed" onPasteClick={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the error banner when parseStatus is "unparsed"', () => {
    renderPanel('unparsed', 'unknown');
    expect(screen.getByRole('button', { name: /paste content instead/i })).toBeInTheDocument();
  });

  it('shows the correct reason label for each error reason', () => {
    const reasons = Object.keys(REASON_LABELS) as ParseErrorReason[];
    for (const reason of reasons) {
      const label = REASON_LABELS[reason];
      const { unmount } = render(
        <AttachmentPanel
          filename="rfq.pdf"
          parseStatus="unparsed"
          parseErrorReason={reason}
          onPasteClick={vi.fn()}
        />,
      );
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it('calls onPasteClick when the paste button is clicked', async () => {
    const user = userEvent.setup();
    const { onPasteClick } = renderPanel('unparsed', 'unknown');

    await user.click(screen.getByRole('button', { name: /paste content instead/i }));

    expect(onPasteClick).toHaveBeenCalledOnce();
  });

  it('sets aria-expanded to false when modal is closed', () => {
    renderPanel('unparsed', 'unknown', false);
    expect(screen.getByRole('button', { name: /paste content instead/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('sets aria-expanded to true when modal is open', () => {
    renderPanel('unparsed', 'unknown', true);
    expect(screen.getByRole('button', { name: /paste content instead/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('threads pasteModalId into aria-controls on the paste button', () => {
    render(
      <AttachmentPanel
        filename="rfq.pdf"
        parseStatus="unparsed"
        onPasteClick={vi.fn()}
        pasteModalId="dialog-:r0:"
      />,
    );
    expect(screen.getByRole('button', { name: /paste content instead/i })).toHaveAttribute(
      'aria-controls',
      'dialog-:r0:',
    );
  });
});
