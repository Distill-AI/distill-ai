import { HttpStatus } from '@nestjs/common';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import { RequestStatus } from '@modules/requests/enums/request-status.enum';
import { ToolStatus } from '@modules/tools/enums/tools.enums';
import { QuoteApprovalActions } from '../actions/quote-approval.actions';
import { QuoteStatus } from '../enums/quote-status.enum';

function buildRequest(status: RequestStatus) {
  return {
    id: 'req-1',
    org_id: 'org-1',
    status,
    sender_contact: 'Jane Doe',
    sender_company: 'Acme Corp',
  };
}

function buildQuote(status: QuoteStatus, overrides: Record<string, unknown> = {}) {
  return {
    id: 'quote-1',
    org_id: 'org-1',
    request_id: 'req-1',
    quote_number: 'Q-001',
    status,
    subtotal_minor: 1000,
    discount_minor: 0,
    total_minor: 1000,
    currency: 'GBP',
    lead_time_days: 5,
    pdf_storage_url: null,
    pdf_generated_at: null,
    email_draft_subject: null,
    email_draft_body: null,
    ...overrides,
  };
}

const LINES = [
  {
    id: 'line-1',
    position: 1,
    sku_id: null,
    description: 'Widget',
    quantity: 1,
    unit_price_minor: 1000,
    amount_minor: 1000,
  },
];

function setup() {
  const requests = {
    get: vi.fn().mockResolvedValue(buildRequest(RequestStatus.PRICED)),
  };
  const quotes = {
    getForRequest: vi
      .fn()
      .mockResolvedValue({ quote: buildQuote(QuoteStatus.DRAFT), lines: LINES }),
    getByIdWithLines: vi.fn(),
    tryClaimForApproval: vi.fn().mockResolvedValue(true),
    markReady: vi.fn().mockResolvedValue(undefined),
    revertToDraft: vi.fn().mockResolvedValue(undefined),
    saveEmailDraft: vi.fn().mockResolvedValue(undefined),
  };
  const toolRegistry = {
    invoke: vi.fn().mockImplementation((toolName: string) => {
      if (toolName === 'render_quote_pdf') {
        return Promise.resolve({
          status: ToolStatus.OK,
          latency: 10,
          result: { storageUrl: 'quotes/org-1/quote-1.pdf', bytesWritten: 100 },
        });
      }
      return Promise.resolve({
        status: ToolStatus.OK,
        latency: 10,
        result: { draft_subject: 'Your quote', draft_body: 'Hi Jane...' },
      });
    }),
  };
  const events = {
    emit: vi.fn().mockResolvedValue(undefined),
  };

  const actions = new QuoteApprovalActions(
    quotes as never,
    requests as never,
    toolRegistry as never,
    events as never,
  );

  return { actions, requests, quotes, toolRegistry, events };
}

describe('QuoteApprovalActions.approveAndGenerate', () => {
  it('claims a draft quote, emits quote.approved, invokes render_quote_pdf, marks ready, and emits quote.ready', async () => {
    const { actions, quotes, toolRegistry, events } = setup();
    quotes.getByIdWithLines.mockResolvedValue({
      quote: buildQuote(QuoteStatus.READY),
      lines: LINES,
    });

    const result = await actions.approveAndGenerate('req-1', 'org-1', 'user-1');

    expect(quotes.tryClaimForApproval).toHaveBeenCalledWith('quote-1', 'user-1');
    expect(events.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'quote.approved',
        requestId: 'req-1',
        quoteId: 'quote-1',
      }),
    );
    expect(toolRegistry.invoke).toHaveBeenCalledWith(
      'render_quote_pdf',
      { quoteId: 'quote-1', idempotencyKey: 'quote-1' },
      'req-1',
      1,
      'org-1',
    );
    expect(quotes.markReady).toHaveBeenCalledWith('quote-1', 'quotes/org-1/quote-1.pdf');
    expect(events.emit).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'quote.ready', requestId: 'req-1', quoteId: 'quote-1' }),
    );
    expect(result.quote.status).toBe(QuoteStatus.READY);
  });

  it('drafts a follow-up email via draft_quote_email and saves it', async () => {
    const { actions, quotes, toolRegistry } = setup();
    quotes.getByIdWithLines.mockResolvedValue({
      quote: buildQuote(QuoteStatus.READY),
      lines: LINES,
    });

    await actions.approveAndGenerate('req-1', 'org-1', 'user-1');

    expect(toolRegistry.invoke).toHaveBeenCalledWith(
      'draft_quote_email',
      expect.objectContaining({
        quoteNumber: 'Q-001',
        senderContact: 'Jane Doe',
        senderCompany: 'Acme Corp',
      }),
      'req-1',
      1,
      'org-1',
    );
    expect(quotes.saveEmailDraft).toHaveBeenCalledWith('quote-1', 'Your quote', 'Hi Jane...');
  });

  it('reverts to draft and throws when render_quote_pdf fails, never emitting quote.ready', async () => {
    const { actions, quotes, toolRegistry, events } = setup();
    toolRegistry.invoke.mockImplementation((toolName: string) => {
      if (toolName === 'render_quote_pdf') {
        return Promise.resolve({ status: ToolStatus.ERROR, latency: 10, error: 'boom' });
      }
      return Promise.resolve({ status: ToolStatus.OK, latency: 10, result: {} });
    });

    await expect(actions.approveAndGenerate('req-1', 'org-1', 'user-1')).rejects.toThrow(
      CustomHttpException,
    );

    expect(quotes.revertToDraft).toHaveBeenCalledWith('quote-1');
    expect(quotes.markReady).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'quote.ready' }),
    );
  });

  it('returns the existing payload without re-invoking the tool when the quote is already READY', async () => {
    const { actions, quotes, toolRegistry } = setup();
    quotes.getForRequest.mockResolvedValue({ quote: buildQuote(QuoteStatus.READY), lines: LINES });

    const result = await actions.approveAndGenerate('req-1', 'org-1', 'user-1');

    expect(quotes.tryClaimForApproval).not.toHaveBeenCalled();
    expect(toolRegistry.invoke).not.toHaveBeenCalled();
    expect(result.quote.status).toBe(QuoteStatus.READY);
  });

  it('returns the existing payload without re-invoking the tool when the quote is already APPROVED', async () => {
    const { actions, quotes, toolRegistry } = setup();
    quotes.getForRequest.mockResolvedValue({
      quote: buildQuote(QuoteStatus.APPROVED),
      lines: LINES,
    });

    const result = await actions.approveAndGenerate('req-1', 'org-1', 'user-1');

    expect(quotes.tryClaimForApproval).not.toHaveBeenCalled();
    expect(toolRegistry.invoke).not.toHaveBeenCalled();
    expect(result.quote.status).toBe(QuoteStatus.APPROVED);
  });

  it('returns 409 when the quote is in SENT', async () => {
    const { actions, quotes } = setup();
    quotes.getForRequest.mockResolvedValue({ quote: buildQuote(QuoteStatus.SENT), lines: LINES });

    await expect(actions.approveAndGenerate('req-1', 'org-1', 'user-1')).rejects.toEqual(
      new CustomHttpException('Quote with status "sent" cannot be approved', HttpStatus.CONFLICT),
    );
  });

  it('returns 409 QUOTE_NOT_PRICED when the request has no quote', async () => {
    const { actions, quotes } = setup();
    quotes.getForRequest.mockResolvedValue(null);

    await expect(actions.approveAndGenerate('req-1', 'org-1', 'user-1')).rejects.toEqual(
      new CustomHttpException('Request req-1 has no priced quote to approve', HttpStatus.CONFLICT),
    );
  });

  it('returns 409 QUOTE_REQUEST_NOT_APPROVABLE when Request.status is FAILED, even with a stray DRAFT quote', async () => {
    const { actions, requests, quotes, toolRegistry } = setup();
    requests.get.mockResolvedValue(buildRequest(RequestStatus.FAILED));

    await expect(actions.approveAndGenerate('req-1', 'org-1', 'user-1')).rejects.toEqual(
      new CustomHttpException(
        'Request with status "failed" is not approvable for a quote',
        HttpStatus.CONFLICT,
      ),
    );
    expect(quotes.getForRequest).not.toHaveBeenCalled();
    expect(toolRegistry.invoke).not.toHaveBeenCalled();
  });

  it('returns 409 QUOTE_REQUEST_NOT_APPROVABLE when Request.status is NEEDS_CLARIFICATION', async () => {
    const { actions, requests } = setup();
    requests.get.mockResolvedValue(buildRequest(RequestStatus.NEEDS_CLARIFICATION));

    await expect(actions.approveAndGenerate('req-1', 'org-1', 'user-1')).rejects.toEqual(
      new CustomHttpException(
        'Request with status "needs_clarification" is not approvable for a quote',
        HttpStatus.CONFLICT,
      ),
    );
  });

  it('returns 404 when the request does not exist', async () => {
    const { actions, requests } = setup();
    requests.get.mockResolvedValue(null);

    await expect(actions.approveAndGenerate('req-1', 'org-1', 'user-1')).rejects.toEqual(
      new CustomHttpException('Request req-1 not found', HttpStatus.NOT_FOUND),
    );
  });

  it('does not throw or block the response when the email-draft tool fails', async () => {
    const { actions, quotes, toolRegistry } = setup();
    quotes.getByIdWithLines.mockResolvedValue({
      quote: buildQuote(QuoteStatus.READY),
      lines: LINES,
    });
    toolRegistry.invoke.mockImplementation((toolName: string) => {
      if (toolName === 'render_quote_pdf') {
        return Promise.resolve({
          status: ToolStatus.OK,
          latency: 10,
          result: { storageUrl: 'quotes/org-1/quote-1.pdf', bytesWritten: 100 },
        });
      }
      return Promise.resolve({ status: ToolStatus.ERROR, latency: 10, error: 'llm down' });
    });

    const result = await actions.approveAndGenerate('req-1', 'org-1', 'user-1');

    expect(quotes.saveEmailDraft).not.toHaveBeenCalled();
    expect(result.quote.status).toBe(QuoteStatus.READY);
  });
});
