import { render, screen } from '@testing-library/react';
import { QuoteDocumentPanel } from './QuoteDocumentPanel';
import type { QuoteDetail } from '../../api/requests';

const quoteFixture: QuoteDetail = {
  quote_number: 'Q-2041',
  status: 'draft',
  subtotal_minor: 378000,
  discount_minor: 0,
  total_minor: 412000,
  currency: 'GBP',
  lead_time_days: 7,
  pdf_storage_url: null,
  pdf_generated_at: null,
  email_draft_subject: null,
  email_draft_body: null,
  lines: [
    {
      position: 1,
      sku_id: 'sku-1',
      description: 'Hex Bolt M10x50 Stainless A4',
      quantity: 2000,
      unit_price_minor: 45,
      amount_minor: 90000,
    },
  ],
};

describe('QuoteDocumentPanel', () => {
  it('renders the quote number, Bill To block, and each line item', () => {
    render(
      <QuoteDocumentPanel
        quote={quoteFixture}
        senderCompany="Apex Fabrication"
        senderContact="James Okafor"
        senderEmail="james.okafor@apexfab.example"
      />,
    );

    expect(screen.getByText('Quote Q-2041')).toBeInTheDocument();
    expect(screen.getByText('Apex Fabrication')).toBeInTheDocument();
    expect(screen.getByText('James Okafor')).toBeInTheDocument();
    expect(screen.getByText('james.okafor@apexfab.example')).toBeInTheDocument();
    expect(screen.getByText('Hex Bolt M10x50 Stainless A4')).toBeInTheDocument();
    expect(screen.getByTestId('quote-document-total')).toHaveTextContent('4,120.00');
  });

  it('omits the Bill To block when no sender fields are available', () => {
    render(
      <QuoteDocumentPanel
        quote={quoteFixture}
        senderCompany={null}
        senderContact={null}
        senderEmail={null}
      />,
    );

    expect(screen.queryByText('Bill To')).not.toBeInTheDocument();
  });

  it('shows the discount row only when discount_minor is greater than zero', () => {
    const { rerender } = render(
      <QuoteDocumentPanel
        quote={quoteFixture}
        senderCompany={null}
        senderContact={null}
        senderEmail={null}
      />,
    );
    expect(screen.queryByText('Discount')).not.toBeInTheDocument();

    rerender(
      <QuoteDocumentPanel
        quote={{ ...quoteFixture, discount_minor: 5000 }}
        senderCompany={null}
        senderContact={null}
        senderEmail={null}
      />,
    );
    expect(screen.getByText('Discount')).toBeInTheDocument();
  });

  it('keeps the totals footer visible with a long line-item table (EC-03)', () => {
    const manyLines = Array.from({ length: 50 }, (_, i) => ({
      position: i + 1,
      sku_id: `sku-${i}`,
      description: `Line item ${i + 1}`,
      quantity: 1,
      unit_price_minor: 100,
      amount_minor: 100,
    }));
    render(
      <QuoteDocumentPanel
        quote={{ ...quoteFixture, lines: manyLines }}
        senderCompany={null}
        senderContact={null}
        senderEmail={null}
      />,
    );

    const total = screen.getByTestId('quote-document-total');
    expect(total).toBeInTheDocument();
    expect(total.closest('dl')).toHaveClass('sticky', 'bottom-0');
  });

  it('renders a line description containing markup as literal text, never as HTML (SEC-01)', () => {
    render(
      <QuoteDocumentPanel
        quote={{
          ...quoteFixture,
          lines: [
            {
              position: 1,
              sku_id: null,
              description: '<img src=x onerror=alert(1)>',
              quantity: 1,
              unit_price_minor: 100,
              amount_minor: 100,
            },
          ],
        }}
        senderCompany={null}
        senderContact={null}
        senderEmail={null}
      />,
    );

    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(document.querySelector('img')).not.toBeInTheDocument();
  });
});
