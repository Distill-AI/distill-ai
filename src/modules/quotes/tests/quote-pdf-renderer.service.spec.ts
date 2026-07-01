import { PDFParse } from 'pdf-parse';
import { QuotePdfRenderer } from '../services/quote-pdf-renderer.service';

describe('QuotePdfRenderer', () => {
  it('renders a PDF whose extracted text contains the quote number, line descriptions, and totals', async () => {
    const renderer = new QuotePdfRenderer();

    const buffer = await renderer.render({
      quoteNumber: 'Q-2026-001',
      senderCompany: 'Acme Corp',
      senderContact: 'Jane Doe',
      senderEmail: 'jane@acme.example',
      lines: [
        { description: 'Widget A', quantity: 2, unitPriceMinor: 1500, amountMinor: 3000 },
        { description: 'Widget B', quantity: 1, unitPriceMinor: 2000, amountMinor: 2000 },
      ],
      subtotalMinor: 5000,
      discountMinor: 500,
      totalMinor: 4500,
      currency: 'GBP',
      leadTimeDays: 7,
    });

    expect(buffer.length).toBeGreaterThan(0);

    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      const text = result.text;

      expect(text).toContain('Q-2026-001');
      expect(text).toContain('Acme Corp');
      expect(text).toContain('Jane Doe');
      expect(text).toContain('jane@acme.example');
      expect(text).toContain('Widget A');
      expect(text).toContain('Widget B');
      expect(text).toContain('50.00');
      expect(text).toContain('5.00');
      expect(text).toContain('45.00');
      expect(text).toContain('7');
    } finally {
      await parser.destroy();
    }
  });

  it('omits bill-to lines that are null rather than rendering "null"', async () => {
    const renderer = new QuotePdfRenderer();

    const buffer = await renderer.render({
      quoteNumber: 'Q-2026-002',
      senderCompany: null,
      senderContact: null,
      senderEmail: null,
      lines: [{ description: 'Widget A', quantity: 1, unitPriceMinor: 1000, amountMinor: 1000 }],
      subtotalMinor: 1000,
      discountMinor: 0,
      totalMinor: 1000,
      currency: 'GBP',
      leadTimeDays: null,
    });

    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      expect(result.text).not.toContain('null');
    } finally {
      await parser.destroy();
    }
  });
});
