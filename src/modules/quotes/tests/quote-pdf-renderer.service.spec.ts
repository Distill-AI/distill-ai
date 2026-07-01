import { PDFParse } from 'pdf-parse';
import { QuotePdfRenderer } from '../services/quote-pdf-renderer.service';

describe('QuotePdfRenderer', () => {
  it('renders a PDF whose extracted text contains the quote number, line descriptions, SKUs, and totals', async () => {
    const renderer = new QuotePdfRenderer();

    const buffer = await renderer.render({
      quoteNumber: 'Q-2026-001',
      issuedDate: new Date('2026-07-01T00:00:00Z'),
      senderCompany: 'Acme Corp',
      senderContact: 'Jane Doe',
      senderEmail: 'jane@acme.example',
      lines: [
        {
          sku: 'WGT-A',
          description: 'Widget A',
          quantity: 2,
          unitPriceMinor: 1500,
          amountMinor: 3000,
        },
        {
          sku: null,
          description: 'Widget B',
          quantity: 1,
          unitPriceMinor: 2000,
          amountMinor: 2000,
        },
      ],
      subtotalMinor: 5000,
      discountMinor: 500,
      totalMinor: 4500,
      currency: 'GBP',
      leadTimeDays: 7,
      terms: 'Net 30',
      validUntil: '2026-08-01',
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
      expect(text).toContain('WGT-A');
      expect(text).toContain('Widget B');
      expect(text).toContain('50.00');
      expect(text).toContain('5.00');
      expect(text).toContain('45.00');
      expect(text).toContain('7');
      expect(text).toContain('Net 30');
    } finally {
      await parser.destroy();
    }
  });

  it('rolls line items onto a new page once they exceed the first page, keeping totals and footer intact', async () => {
    const renderer = new QuotePdfRenderer();

    const buffer = await renderer.render({
      quoteNumber: 'Q-2026-003',
      issuedDate: new Date('2026-07-01T00:00:00Z'),
      senderCompany: 'Acme Corp',
      senderContact: 'Jane Doe',
      senderEmail: 'jane@acme.example',
      lines: Array.from({ length: 30 }, (_, i) => ({
        sku: `SKU-${i}`,
        description: `Widget ${i}`,
        quantity: 1,
        unitPriceMinor: 1000,
        amountMinor: 1000,
      })),
      subtotalMinor: 30000,
      discountMinor: 0,
      totalMinor: 30000,
      currency: 'GBP',
      leadTimeDays: 10,
      terms: 'Net 30',
      validUntil: '2026-08-01',
    });

    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      expect(result.total).toBeGreaterThan(1);
      expect(result.text).toContain('Widget 0');
      expect(result.text).toContain('Widget 29');
      expect(result.text).toContain('Total');
      expect(result.text).toContain('Lead time: 10 days');
      expect(result.text).toContain('Net 30');
    } finally {
      await parser.destroy();
    }
  });

  it('omits bill-to lines, SKU, and footer fields that are null rather than rendering "null"', async () => {
    const renderer = new QuotePdfRenderer();

    const buffer = await renderer.render({
      quoteNumber: 'Q-2026-002',
      issuedDate: new Date('2026-07-01T00:00:00Z'),
      senderCompany: null,
      senderContact: null,
      senderEmail: null,
      lines: [
        {
          sku: null,
          description: 'Widget A',
          quantity: 1,
          unitPriceMinor: 1000,
          amountMinor: 1000,
        },
      ],
      subtotalMinor: 1000,
      discountMinor: 0,
      totalMinor: 1000,
      currency: 'GBP',
      leadTimeDays: null,
      terms: null,
      validUntil: null,
    });

    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      expect(result.text).not.toContain('null');
      expect(result.text).not.toContain('SKU:');
    } finally {
      await parser.destroy();
    }
  });
});
