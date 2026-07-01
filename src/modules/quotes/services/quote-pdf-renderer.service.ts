import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

export interface QuotePdfLineInput {
  sku: string | null;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  amountMinor: number;
}

export interface QuotePdfInput {
  quoteNumber: string;
  issuedDate: Date;
  senderCompany: string | null;
  senderContact: string | null;
  senderEmail: string | null;
  lines: QuotePdfLineInput[];
  subtotalMinor: number;
  discountMinor: number;
  totalMinor: number;
  currency: string;
  leadTimeDays: number | null;
  terms: string | null;
  validUntil: string | null;
}

/** Mirrors client/src/tokens.json - pdfkit has no access to the CSS token pipeline. */
const COLOR = {
  brand: '#4F46E5',
  ink: '#0F172A',
  body: '#475569',
  muted: '#94A3B8',
  border: '#E5E7EB',
};

const PAGE_MARGIN = 50;
const TOTALS_BLOCK_HEIGHT = 80;
const FOOTER_BLOCK_HEIGHT = 40;

/** Formats a minor-unit amount for display. Money is stored and compared in minor units everywhere
 * else in this codebase; this is the one place it is converted to a decimal string. */
function formatMinor(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

const DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Parses date-only strings as UTC midnight so the rendered date can't shift by a day depending on
 * the host timezone the service happens to run in. */
function formatDate(value: Date | string): string {
  const isDateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = isDateOnly ? new Date(`${value}T00:00:00Z`) : new Date(value);
  return DATE_FORMATTER.format(date);
}

interface Columns {
  contentWidth: number;
  rightEdge: number;
  desc: { x: number; width: number };
  qty: { x: number; width: number };
  price: { x: number; width: number };
  amount: { x: number; width: number };
}

function buildColumns(doc: PDFKit.PDFDocument): Columns {
  const contentWidth = doc.page.width - PAGE_MARGIN * 2;
  const descWidth = contentWidth * 0.52;
  const qtyWidth = contentWidth * 0.12;
  const priceWidth = contentWidth * 0.18;
  const amountWidth = contentWidth - descWidth - qtyWidth - priceWidth;
  const descX = PAGE_MARGIN;
  const qtyX = descX + descWidth;
  const priceX = qtyX + qtyWidth;
  const amountX = priceX + priceWidth;
  return {
    contentWidth,
    rightEdge: PAGE_MARGIN + contentWidth,
    desc: { x: descX, width: descWidth },
    qty: { x: qtyX, width: qtyWidth },
    price: { x: priceX, width: priceWidth },
    amount: { x: amountX, width: amountWidth },
  };
}

/** Bottom edge of the printable area; content at or past this y must roll onto a new page. */
function pageBottom(doc: PDFKit.PDFDocument): number {
  return doc.page.height - PAGE_MARGIN;
}

/** Templates a priced quote into a PDF matching the Figma "Quote Output" layout. */
@Injectable()
export class QuotePdfRenderer {
  async render(input: QuotePdfInput): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const columns = buildColumns(doc);
    let y = this.renderHeader(doc, columns, input);
    y = this.renderBillTo(doc, columns, input, y);
    y = this.renderLineItems(doc, columns, input.lines, input.currency, y);
    y = this.ensureRoom(doc, columns, y, TOTALS_BLOCK_HEIGHT);
    y = this.renderTotals(doc, columns, input, y);
    y = this.ensureRoom(doc, columns, y, FOOTER_BLOCK_HEIGHT);
    this.renderFooter(doc, columns, input, y);

    doc.end();
    return done;
  }

  /** Starts a new page and repositions to the top margin when `needed` vertical space won't fit. */
  private ensureRoom(doc: PDFKit.PDFDocument, columns: Columns, y: number, needed: number): number {
    if (y + needed <= pageBottom(doc)) {
      return y;
    }
    doc.addPage();
    return PAGE_MARGIN;
  }

  private renderHeader(doc: PDFKit.PDFDocument, columns: Columns, input: QuotePdfInput): number {
    const top = PAGE_MARGIN;
    const logoX = columns.desc.x;
    doc
      .polygon([logoX, top + 7], [logoX + 7, top], [logoX + 14, top + 7], [logoX + 7, top + 14])
      .fill(COLOR.brand);
    doc
      .fillColor(COLOR.ink)
      .fontSize(14)
      .text('Distill.ai', columns.desc.x + 20, top + 1);

    doc.fillColor(COLOR.ink).fontSize(16).text(`QUOTE ${input.quoteNumber}`, columns.desc.x, top, {
      width: columns.contentWidth,
      align: 'right',
    });
    doc
      .fillColor(COLOR.muted)
      .fontSize(9)
      .text(`Date: ${formatDate(input.issuedDate)}`, columns.desc.x, top + 20, {
        width: columns.contentWidth,
        align: 'right',
      });

    const ruleY = top + 40;
    doc
      .moveTo(columns.desc.x, ruleY)
      .lineTo(columns.rightEdge, ruleY)
      .strokeColor(COLOR.border)
      .stroke();
    return ruleY + 20;
  }

  private renderBillTo(
    doc: PDFKit.PDFDocument,
    columns: Columns,
    input: QuotePdfInput,
    startY: number,
  ): number {
    let y = startY;
    doc.fillColor(COLOR.muted).fontSize(8).text('BILL TO', columns.desc.x, y);
    y += 14;
    if (input.senderCompany) {
      doc.fillColor(COLOR.ink).fontSize(11).text(input.senderCompany, columns.desc.x, y);
      y += 15;
    }
    if (input.senderContact) {
      doc.fillColor(COLOR.body).fontSize(10).text(input.senderContact, columns.desc.x, y);
      y += 14;
    }
    if (input.senderEmail) {
      doc.fillColor(COLOR.body).fontSize(10).text(input.senderEmail, columns.desc.x, y);
      y += 14;
    }
    return y + 30;
  }

  private renderColumnHeaders(doc: PDFKit.PDFDocument, columns: Columns, startY: number): number {
    let y = startY;
    doc.fillColor(COLOR.muted).fontSize(8);
    doc.text('ITEM DESCRIPTION', columns.desc.x, y, { width: columns.desc.width });
    doc.text('QTY', columns.qty.x, y, { width: columns.qty.width, align: 'right' });
    doc.text('UNIT PRICE', columns.price.x, y, { width: columns.price.width, align: 'right' });
    doc.text('AMOUNT', columns.amount.x, y, { width: columns.amount.width, align: 'right' });
    y += 16;
    doc.moveTo(columns.desc.x, y).lineTo(columns.rightEdge, y).strokeColor(COLOR.border).stroke();
    return y + 10;
  }

  private renderLineItems(
    doc: PDFKit.PDFDocument,
    columns: Columns,
    lines: QuotePdfLineInput[],
    currency: string,
    startY: number,
  ): number {
    let y = this.renderColumnHeaders(doc, columns, startY);

    for (const line of lines) {
      doc.fontSize(10);
      const descHeight = doc.heightOfString(line.description, { width: columns.desc.width });
      const skuHeight = line.sku ? 13 : 0;
      const rowHeight = descHeight + skuHeight + 22;
      if (y + rowHeight > pageBottom(doc)) {
        doc.addPage();
        y = this.renderColumnHeaders(doc, columns, PAGE_MARGIN);
      }

      doc.fillColor(COLOR.ink).fontSize(10).text(line.description, columns.desc.x, y, {
        width: columns.desc.width,
      });
      doc.fillColor(COLOR.ink).fontSize(10).text(String(line.quantity), columns.qty.x, y, {
        width: columns.qty.width,
        align: 'right',
      });
      doc
        .fillColor(COLOR.ink)
        .fontSize(10)
        .text(formatMinor(line.unitPriceMinor, currency), columns.price.x, y, {
          width: columns.price.width,
          align: 'right',
        });
      doc
        .fillColor(COLOR.ink)
        .fontSize(10)
        .text(formatMinor(line.amountMinor, currency), columns.amount.x, y, {
          width: columns.amount.width,
          align: 'right',
        });
      y += descHeight;
      if (line.sku) {
        doc.fillColor(COLOR.muted).fontSize(8).text(`SKU: ${line.sku}`, columns.desc.x, y, {
          width: columns.desc.width,
        });
        y += 13;
      }
      y += 8;
      doc.moveTo(columns.desc.x, y).lineTo(columns.rightEdge, y).strokeColor(COLOR.border).stroke();
      y += 14;
    }

    return y;
  }

  private renderTotals(
    doc: PDFKit.PDFDocument,
    columns: Columns,
    input: QuotePdfInput,
    startY: number,
  ): number {
    let y = startY;
    const labelWidth = columns.price.width;
    const labelX = columns.price.x;
    const valueX = columns.amount.x;
    const valueWidth = columns.amount.width;

    doc.fillColor(COLOR.body).fontSize(10);
    doc.text('Subtotal', labelX, y, { width: labelWidth, align: 'left' });
    doc.text(formatMinor(input.subtotalMinor, input.currency), valueX, y, {
      width: valueWidth,
      align: 'right',
    });
    y += 18;

    if (input.discountMinor > 0) {
      doc.fillColor(COLOR.body).fontSize(10);
      doc.text('Discount', labelX, y, { width: labelWidth, align: 'left' });
      doc.text(`-${formatMinor(input.discountMinor, input.currency)}`, valueX, y, {
        width: valueWidth,
        align: 'right',
      });
      y += 18;
    }

    doc.fillColor(COLOR.ink).fontSize(12);
    doc.text(`Total (${input.currency})`, labelX, y, { width: labelWidth, align: 'left' });
    doc.fillColor(COLOR.brand).text(formatMinor(input.totalMinor, input.currency), valueX, y, {
      width: valueWidth,
      align: 'right',
    });
    return y + 30;
  }

  private renderFooter(
    doc: PDFKit.PDFDocument,
    columns: Columns,
    input: QuotePdfInput,
    startY: number,
  ): void {
    const parts: string[] = [];
    if (input.leadTimeDays !== null) {
      parts.push(`Lead time: ${input.leadTimeDays} days`);
    }
    if (input.terms) {
      parts.push(`Terms: ${input.terms}`);
    }
    if (input.validUntil) {
      parts.push(`Valid until ${formatDate(input.validUntil)}`);
    }
    if (parts.length === 0) {
      return;
    }

    doc
      .moveTo(columns.desc.x, startY)
      .lineTo(columns.rightEdge, startY)
      .strokeColor(COLOR.border)
      .stroke();
    doc
      .fillColor(COLOR.muted)
      .fontSize(9)
      .text(parts.join('. '), columns.desc.x, startY + 12, {
        width: columns.contentWidth,
      });
  }
}
