import { render, screen } from '@testing-library/react';
import { QuoteContextCard } from './QuoteContextCard';

describe('QuoteContextCard', () => {
  it('renders the confidence badge, line count summary, and source filename', () => {
    render(
      <QuoteContextCard confidence={0.98} lineCount={5} sourceFilename="RFQ_Apex_Oct24.eml" />,
    );

    expect(screen.getByText('98% Match')).toBeInTheDocument();
    expect(screen.getByText(/mapped all 5 requested items/i)).toBeInTheDocument();
    expect(screen.getByText(/at 98% confidence/i)).toBeInTheDocument();
    expect(screen.getByText(/RFQ_Apex_Oct24\.eml/)).toBeInTheDocument();
  });

  it('singularizes the summary for a single line item', () => {
    render(<QuoteContextCard confidence={0.9} lineCount={1} sourceFilename={null} />);

    expect(screen.getByText(/mapped all 1 requested item\b/i)).toBeInTheDocument();
  });

  it('omits the confidence badge and confidence clause when confidence is null', () => {
    render(<QuoteContextCard confidence={null} lineCount={3} sourceFilename={null} />);

    expect(screen.queryByText(/% Match/)).not.toBeInTheDocument();
    expect(screen.getByText(/mapped all 3 requested items\./)).toBeInTheDocument();
  });

  it('omits the source line when no filename is available', () => {
    render(<QuoteContextCard confidence={0.9} lineCount={3} sourceFilename={null} />);

    expect(screen.queryByText(/Source:/)).not.toBeInTheDocument();
  });
});
