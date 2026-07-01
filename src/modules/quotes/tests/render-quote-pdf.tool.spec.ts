import { HttpStatus } from '@nestjs/common';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import { RenderQuotePdfToolFactory } from '../tools/render-quote-pdf.tool';
import { QuoteStatus } from '../enums/quote-status.enum';

const QUOTE_ID = '11111111-1111-1111-1111-111111111111';
const ORG_ID = '22222222-2222-2222-2222-222222222222';
const OTHER_ORG_ID = '33333333-3333-3333-3333-333333333333';
const REQUEST_ID = '44444444-4444-4444-4444-444444444444';
const MISSING_QUOTE_ID = '55555555-5555-5555-5555-555555555555';
const STORAGE_URL = `quotes/${ORG_ID}/${QUOTE_ID}/idem-1.pdf`;

function setup() {
  const quote = {
    id: QUOTE_ID,
    org_id: ORG_ID,
    request_id: REQUEST_ID,
    quote_number: 'Q-001',
    status: QuoteStatus.APPROVED,
    subtotal_minor: 1000,
    discount_minor: 0,
    total_minor: 1000,
    currency: 'GBP',
    lead_time_days: 5,
    terms: 'Net 30',
    valid_until: '2026-08-01',
    created_at: new Date('2026-07-01T00:00:00Z'),
  };
  const lines = [
    {
      id: 'line-1',
      sku: { sku_code: 'HX-M10-50-A4' },
      description: 'Widget',
      quantity: 1,
      unit_price_minor: 1000,
      amount_minor: 1000,
    },
  ];
  const request = {
    id: REQUEST_ID,
    sender_company: 'Acme',
    sender_contact: 'Jane',
    sender_email: 'jane@acme.example',
  };

  const quotes = {
    getByIdWithLines: vi.fn().mockResolvedValue({ quote, lines }),
    markReady: vi.fn().mockResolvedValue(true),
  };
  const requests = {
    get: vi.fn().mockResolvedValue(request),
  };
  const bytes = Buffer.from('pdf-bytes');
  const renderer = {
    render: vi.fn().mockResolvedValue(bytes),
  };
  const objectStore = {
    put: vi.fn().mockResolvedValue(STORAGE_URL),
  };

  const factory = new RenderQuotePdfToolFactory(
    quotes as never,
    requests as never,
    renderer as never,
    objectStore as never,
  );

  return { factory, quotes, requests, renderer, objectStore, quote, lines, request, bytes };
}

describe('RenderQuotePdfToolFactory', () => {
  it('renders the quote, writes it under a deterministic key, and returns the result', async () => {
    const { factory, renderer, objectStore, quotes } = setup();
    const contract = factory.create();

    const result = await contract.execute({
      quoteId: QUOTE_ID,
      orgId: ORG_ID,
      idempotencyKey: 'idem-1',
    });

    expect(renderer.render).toHaveBeenCalledWith(
      expect.objectContaining({
        quoteNumber: 'Q-001',
        issuedDate: new Date('2026-07-01T00:00:00Z'),
        senderCompany: 'Acme',
        senderContact: 'Jane',
        senderEmail: 'jane@acme.example',
        lines: [
          {
            sku: 'HX-M10-50-A4',
            description: 'Widget',
            quantity: 1,
            unitPriceMinor: 1000,
            amountMinor: 1000,
          },
        ],
        terms: 'Net 30',
        validUntil: '2026-08-01',
      }),
    );
    expect(objectStore.put).toHaveBeenCalledWith(STORAGE_URL, expect.any(Buffer));
    expect(quotes.markReady).toHaveBeenCalledWith(QUOTE_ID, STORAGE_URL);
    expect(result).toEqual({ storageUrl: STORAGE_URL, bytesWritten: 9 });
  });

  it('produces the same key for repeated calls with the same idempotencyKey', async () => {
    const { factory, objectStore } = setup();
    const contract = factory.create();

    await contract.execute({ quoteId: QUOTE_ID, orgId: ORG_ID, idempotencyKey: 'idem-1' });
    await contract.execute({ quoteId: QUOTE_ID, orgId: ORG_ID, idempotencyKey: 'idem-1' });

    const keys = objectStore.put.mock.calls.map((call: unknown[]) => call[0]);
    expect(keys).toEqual([STORAGE_URL, STORAGE_URL]);
  });

  it('throws before touching object storage when the quote is not found', async () => {
    const { factory, quotes, objectStore } = setup();
    quotes.getByIdWithLines.mockResolvedValue(null);
    const contract = factory.create();

    await expect(
      contract.execute({ quoteId: MISSING_QUOTE_ID, orgId: ORG_ID, idempotencyKey: 'idem-1' }),
    ).rejects.toEqual(
      new CustomHttpException(`Quote ${MISSING_QUOTE_ID} not found`, HttpStatus.NOT_FOUND),
    );
    expect(objectStore.put).not.toHaveBeenCalled();
  });

  it('throws when the quote belongs to a different org', async () => {
    const { factory, objectStore } = setup();
    const contract = factory.create();

    await expect(
      contract.execute({ quoteId: QUOTE_ID, orgId: OTHER_ORG_ID, idempotencyKey: 'idem-1' }),
    ).rejects.toEqual(new CustomHttpException(`Quote ${QUOTE_ID} not found`, HttpStatus.NOT_FOUND));
    expect(objectStore.put).not.toHaveBeenCalled();
  });

  it('throws when the quote references a request that no longer exists', async () => {
    const { factory, requests, objectStore } = setup();
    requests.get.mockResolvedValue(null);
    const contract = factory.create();

    await expect(
      contract.execute({ quoteId: QUOTE_ID, orgId: ORG_ID, idempotencyKey: 'idem-1' }),
    ).rejects.toThrow(CustomHttpException);
    expect(objectStore.put).not.toHaveBeenCalled();
  });
});
