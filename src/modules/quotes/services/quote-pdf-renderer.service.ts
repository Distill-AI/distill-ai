import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

export interface QuotePdfLineInput {
  description: string;
  quantity: number;
  unitPriceMinor: number;
  amountMinor: number;
}

export interface QuotePdfInput {
  quoteNumber: string;
  senderCompany: string | null;
  senderContact: string | null;
  senderEmail: string | null;
  lines: QuotePdfLineInput[];
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  currency: string;
  leadTimeDays: number | null;
}

/** Formats a minor-unit amount for display. Money is stored and compared in minor units everywhere
 * else in this codebase; this is the one place it is converted to a decimal string. */
function formatMinor(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

/** Templates a priced quote into a PDF matching the Figma "Quote Output" layout. */
@Injectable()
export class QuotePdfRenderer {
  async render(input: QuotePdfInput): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    this.renderHeader(doc, input.quoteNumber);
    this.renderBillTo(doc, input);
    this.renderLineItems(doc, input.lines, input.currency);
    this.renderTotals(doc, input);

    doc.end();
    return done;
  }

  private renderHeader(doc: PDFKit.PDFDocument, quoteNumber: string): void {
    doc.fontSize(20).text('Quote', { continued: false });
    doc.fontSize(12).text(`Quote number: ${quoteNumber}`);
    doc.moveDown();
  }

  private renderBillTo(doc: PDFKit.PDFDocument, input: QuotePdfInput): void {
    doc.fontSize(12).text('Bill To');
    if (input.senderCompany) doc.fontSize(10).text(input.senderCompany);
    if (input.senderContact) doc.fontSize(10).text(input.senderContact);
    if (input.senderEmail) doc.fontSize(10).text(input.senderEmail);
    doc.moveDown();
  }

  private renderLineItems(
    doc: PDFKit.PDFDocument,
    lines: QuotePdfLineInput[],
    currency: string,
  ): void {
    doc.fontSize(12).text('Items');
    for (const line of lines) {
      doc
        .fontSize(10)
        .text(
          `${line.description}  x${line.quantity}  ${formatMinor(line.unitPriceMinor, currency)}  ${formatMinor(line.amountMinor, currency)}`,
        );
    }
    doc.moveDown();
  }

  private renderTotals(doc: PDFKit.PDFDocument, input: QuotePdfInput): void {
    doc.fontSize(10).text(`Subtotal: ${formatMinor(input.subtotalMinor, input.currency)}`);
    if (input.discountMinor > 0) {
      doc.text(`Discount: ${formatMinor(input.discountMinor, input.currency)}`);
    }
    doc.fontSize(12).text(`Total: ${formatMinor(input.totalMinor, input.currency)}`);
    if (input.leadTimeDays !== null) {
      doc.fontSize(10).text(`Lead time: ${input.leadTimeDays} days`);
    }
  }
}
