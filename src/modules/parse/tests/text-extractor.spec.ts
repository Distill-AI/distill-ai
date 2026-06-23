import { extractText, MAX_PARSED_TEXT_CHARS } from '../text-extractor';

describe('extractText', () => {
  it('returns CSV bytes as UTF-8 text unchanged', async () => {
    const csv = 'sku,qty\nBOLT-M12,200\n';
    const text = await extractText(Buffer.from(csv, 'utf8'), 'items.csv');
    expect(text).toBe(csv);
  });

  it('returns TXT bytes as UTF-8 text unchanged', async () => {
    const txt = 'Need 200 M12 bolts, delivery in 2 weeks.';
    const text = await extractText(Buffer.from(txt, 'utf8'), 'notes.txt');
    expect(text).toBe(txt);
  });

  it('dispatches by extension case-insensitively', async () => {
    const text = await extractText(Buffer.from('a,b\n1,2\n', 'utf8'), 'DATA.CSV');
    expect(text).toBe('a,b\n1,2\n');
  });

  it('throws for an unsupported extension', async () => {
    await expect(extractText(Buffer.from('x'), 'contract.docx')).rejects.toThrow(
      /unsupported file type/i,
    );
  });

  it('caps extracted text at MAX_PARSED_TEXT_CHARS', async () => {
    const huge = 'a'.repeat(MAX_PARSED_TEXT_CHARS + 500);
    const text = await extractText(Buffer.from(huge, 'utf8'), 'big.txt');
    expect(text).toHaveLength(MAX_PARSED_TEXT_CHARS);
  });

  it('extracts text from a real PDF', async () => {
    const pdf = buildMinimalPdf('Hello RFQ');
    const text = await extractText(pdf, 'quote.pdf');
    expect(text).toContain('Hello RFQ');
  });
});

/**
 * Build a minimal single-page PDF that renders `content` as text, so the PDF path is exercised
 * against a genuine (if tiny) document rather than a mock. Hand-assembled with a correct xref so
 * pdf-parse/pdfjs accepts it.
 */
function buildMinimalPdf(content: string): Buffer {
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
      '/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n',
    `4 0 obj\n<< /Length 60 >>\nstream\nBT /F1 24 Tf 72 700 Td (${content}) Tj ET\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];

  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += obj;
  }
  const xrefStart = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n`;
  body += '0000000000 65535 f \n';
  for (const off of offsets) {
    body += `${off.toString().padStart(10, '0')} 00000 n \n`;
  }
  body +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` + `startxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(body, 'latin1');
}
