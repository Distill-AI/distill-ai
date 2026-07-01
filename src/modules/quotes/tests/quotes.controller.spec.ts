import { NotFoundException } from '@nestjs/common';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import { QuotesController } from '../quotes.controller';
import { QuoteApprovalActions } from '../actions/quote-approval.actions';
import { QuoteModelAction } from '../quote.model-action';
import { RequestModelAction } from '@modules/requests/requests.model-action';
import type { AuthUser } from '@modules/auth/interfaces/auth-user.interface';

vi.mock('@config/auth.config', () => ({ authConfig: { enabled: true } }));

function makeRes() {
  return {
    setHeader: vi.fn(),
    send: vi.fn(),
  } as unknown as import('express').Response & {
    setHeader: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
  };
}

const mockUser: AuthUser = {
  userId: 'user-1',
  orgId: 'org-1',
  roles: ['estimator'],
  email: 'estimator@example.com',
};

function setup() {
  const approvalActions: Partial<QuoteApprovalActions> = {
    approveAndGenerate: vi.fn().mockResolvedValue({
      quote: {
        quote_number: 'Q-001',
        status: 'ready',
        pdf_storage_url: 'quotes/org-1/quote-1.pdf',
      },
    }),
  };
  const quotes: Partial<QuoteModelAction> = {
    getForRequest: vi.fn().mockResolvedValue({
      quote: { quote_number: 'Q-001', pdf_storage_url: 'quotes/org-1/quote-1.pdf' },
      lines: [],
    }),
  };
  const requests: Partial<RequestModelAction> = {
    get: vi.fn().mockResolvedValue({ id: 'req-1', org_id: 'org-1' }),
  };
  const objectStore = {
    put: vi.fn(),
    get: vi.fn().mockResolvedValue(Buffer.from('pdf-bytes')),
  };

  const controller = new QuotesController(
    approvalActions as QuoteApprovalActions,
    quotes as QuoteModelAction,
    requests as RequestModelAction,
    objectStore as never,
  );

  return { controller, approvalActions, quotes, requests, objectStore };
}

describe('QuotesController.approveAndGenerate', () => {
  it('returns the approval payload for a request in the caller org', async () => {
    const { controller, approvalActions } = setup();

    const result = await controller.approveAndGenerate('req-1', { user: mockUser });

    expect(approvalActions.approveAndGenerate).toHaveBeenCalledWith('req-1', 'org-1', 'user-1');
    expect(result.statusCode).toBe(200);
    expect(result.data.quote.quote_number).toBe('Q-001');
  });

  it('404s for a cross-org request without calling the approval action', async () => {
    const { controller, requests, approvalActions } = setup();
    (requests.get as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'req-1', org_id: 'org-2' });

    await expect(controller.approveAndGenerate('req-1', { user: mockUser })).rejects.toThrow(
      NotFoundException,
    );
    expect(approvalActions.approveAndGenerate).not.toHaveBeenCalled();
  });

  it('404s when the request does not exist', async () => {
    const { controller, requests } = setup();
    (requests.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(controller.approveAndGenerate('missing', { user: mockUser })).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('QuotesController.downloadPdf', () => {
  it('streams the PDF bytes with the right headers', async () => {
    const { controller, objectStore } = setup();
    const res = makeRes();

    await controller.downloadPdf('req-1', { user: mockUser }, res);

    expect(objectStore.get).toHaveBeenCalledWith('quotes/org-1/quote-1.pdf');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.send).toHaveBeenCalledWith(Buffer.from('pdf-bytes'));
  });

  it('404s when the quote has no generated PDF yet', async () => {
    const { controller, quotes } = setup();
    (quotes.getForRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
      quote: { quote_number: 'Q-001', pdf_storage_url: null },
      lines: [],
    });
    const res = makeRes();

    await expect(controller.downloadPdf('req-1', { user: mockUser }, res)).rejects.toThrow(
      CustomHttpException,
    );
  });

  it('404s when the request has no quote at all', async () => {
    const { controller, quotes } = setup();
    (quotes.getForRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = makeRes();

    await expect(controller.downloadPdf('req-1', { user: mockUser }, res)).rejects.toThrow(
      CustomHttpException,
    );
  });

  it('404s for a cross-org request', async () => {
    const { controller, requests } = setup();
    (requests.get as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'req-1', org_id: 'org-2' });
    const res = makeRes();

    await expect(controller.downloadPdf('req-1', { user: mockUser }, res)).rejects.toThrow(
      NotFoundException,
    );
  });
});
