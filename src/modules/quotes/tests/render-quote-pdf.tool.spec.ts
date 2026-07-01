import { HttpStatus } from '@nestjs/common';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import { RenderQuotePdfToolFactory } from '../tools/render-quote-pdf.tool';
import { QuoteStatus } from '../enums/quote-status.enum';

function setup() {
  const quote = {
    id: 'quote-1',
    org_id: 'org-1',
    request_id: 'req-1',
    quote_number: 'Q-001',
    status: QuoteStatus.APPROVED,
    subtotal_minor: 1000,
    discount_minor: 0,
    total_minor: 1000,
    currency: 'GBP',
    lead_time_days: 5,
  };
  const lines = [
    {
      id: 'line-1',
      description: 'Widget',
      quantity: 1,
      unit_price_minor: 1000,
      amount_minor: 1000,
    },
  ];
  const request = {
    id: 'req-1',
    sender_company: 'Acme',
    sender_contact: 'Jane',
    sender_email: 'jane@acme.example',
  };

  const quotes = {
    getByIdWithLines: vi.fn().mockResolvedValue({ quote, lines }),
  };
  const requests = {
    get: vi.fn().mockResolvedValue(request),
  };
  const bytes = Buffer.from('pdf-bytes');
  const renderer = {
    render: vi.fn().mockResolvedValue(bytes),
  };
  const objectStore = {
    put: vi.fn().mockResolvedValue('quotes/org-1/quote-1/idem-1.pdf'),
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
    const { factory, renderer, objectStore } = setup();
    const contract = factory.create();

    const result = await contract.execute({
      quoteId: 'quote-1',
      orgId: 'org-1',
      idempotencyKey: 'idem-1',
    });

    expect(renderer.render).toHaveBeenCalledWith(
      expect.objectContaining({
        quoteNumber: 'Q-001',
        senderCompany: 'Acme',
        senderContact: 'Jane',
        senderEmail: 'jane@acme.example',
        lines: [{ description: 'Widget', quantity: 1, unitPriceMinor: 1000, amountMinor: 1000 }],
      }),
    );
    expect(objectStore.put).toHaveBeenCalledWith(
      'quotes/org-1/quote-1/idem-1.pdf',
      expect.any(Buffer),
    );
    expect(result).toEqual({ storageUrl: 'quotes/org-1/quote-1/idem-1.pdf', bytesWritten: 9 });
  });

  it('produces the same key for repeated calls with the same idempotencyKey', async () => {
    const { factory, objectStore } = setup();
    const contract = factory.create();

    await contract.execute({ quoteId: 'quote-1', orgId: 'org-1', idempotencyKey: 'idem-1' });
    await contract.execute({ quoteId: 'quote-1', orgId: 'org-1', idempotencyKey: 'idem-1' });

    const keys = objectStore.put.mock.calls.map((call: unknown[]) => call[0]);
    expect(keys).toEqual(['quotes/org-1/quote-1/idem-1.pdf', 'quotes/org-1/quote-1/idem-1.pdf']);
  });

  it('throws before touching object storage when the quote is not found', async () => {
    const { factory, quotes, objectStore } = setup();
    quotes.getByIdWithLines.mockResolvedValue(null);
    const contract = factory.create();

    await expect(
      contract.execute({ quoteId: 'missing', orgId: 'org-1', idempotencyKey: 'idem-1' }),
    ).rejects.toEqual(new CustomHttpException('Quote missing not found', HttpStatus.NOT_FOUND));
    expect(objectStore.put).not.toHaveBeenCalled();
  });

  it('throws when the quote belongs to a different org', async () => {
    const { factory, objectStore } = setup();
    const contract = factory.create();

    await expect(
      contract.execute({ quoteId: 'quote-1', orgId: 'org-2', idempotencyKey: 'idem-1' }),
    ).rejects.toEqual(new CustomHttpException('Quote quote-1 not found', HttpStatus.NOT_FOUND));
    expect(objectStore.put).not.toHaveBeenCalled();
  });

  it('throws when the quote references a request that no longer exists', async () => {
    const { factory, requests, objectStore } = setup();
    requests.get.mockResolvedValue(null);
    const contract = factory.create();

    await expect(
      contract.execute({ quoteId: 'quote-1', orgId: 'org-1', idempotencyKey: 'idem-1' }),
    ).rejects.toThrow(CustomHttpException);
    expect(objectStore.put).not.toHaveBeenCalled();
  });
});
