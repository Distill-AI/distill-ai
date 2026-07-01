import { render, screen } from '@testing-library/react';
import { BlockingItemsCard } from './BlockingItemsCard';

describe('BlockingItemsCard', () => {
  it('renders one row per gap', () => {
    render(
      <BlockingItemsCard
        gaps={[
          'invoice.pdf: This file contains only scanned images with no readable text.',
          'quote.docx: This file appears to be password-protected or corrupt.',
        ]}
      />,
    );

    expect(
      screen.getByText(
        'invoice.pdf: This file contains only scanned images with no readable text.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('quote.docx: This file appears to be password-protected or corrupt.'),
    ).toBeInTheDocument();
  });

  it('pluralizes the summary count correctly', () => {
    const { rerender } = render(<BlockingItemsCard gaps={['one gap']} />);
    expect(screen.getByText('1 item is blocking a confident quote')).toBeInTheDocument();

    rerender(<BlockingItemsCard gaps={['gap one', 'gap two']} />);
    expect(screen.getByText('2 items are blocking a confident quote')).toBeInTheDocument();
  });

  it('renders gap text as literal content, not HTML (SEC-01)', () => {
    render(<BlockingItemsCard gaps={['<img src=x onerror=alert(1)>']} />);
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(document.querySelector('img')).not.toBeInTheDocument();
  });
});
