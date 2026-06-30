import { RequestsService } from '../services/requests.service';
import { RequestModelAction } from '../requests.model-action';
import { LineItemModelAction } from '@modules/catalog/line-item.model-action';
import { QuoteModelAction } from '@modules/quotes/quote.model-action';
import { AttachmentsService } from '../services/attachments.service';
import type { Request } from '../entities/request.entity';

const mockRequest = {
  id: 'req-1',
  org_id: 'org-1',
  sender_company: 'Apex',
  sender_contact: 'Dana',
  sender_email: 'dana@apex.example',
  source_subject: 'RFQ',
  source_body: 'please quote',
  request_type: 'catalog_rfq',
  overall_confidence: 0.96,
  status: 'needs_review',
  current_node: 'extract',
  created_at: new Date('2026-06-24T10:00:00.000Z'),
} as unknown as Request;

describe('RequestsService', () => {
  let service: RequestsService;
  let modelAction: Partial<RequestModelAction>;
  let lineItems: Partial<LineItemModelAction>;
  let quotes: Partial<QuoteModelAction>;
  let attachmentsService: Partial<AttachmentsService>;

  beforeEach(() => {
    modelAction = {
      list: vi.fn().mockResolvedValue({
        payload: [mockRequest],
        paginationMeta: { total: 1, page: 1, limit: 50 },
      }),
    };
    lineItems = {
      list: vi.fn().mockResolvedValue({
        payload: [
          {
            id: 'li-1',
            position: 1,
            raw_text: 'M6 bolts x100',
            quantity: 100,
            unit_price_minor: 900,
            match_confidence: 0.62,
            matched_sku: { id: 'sku-1', sku_code: 'SKU-061', name: 'M6 Hex Bolt' },
            flags: ['close_tie'],
          },
        ],
        paginationMeta: { total: 1 },
      }),
    };
    quotes = {
      getForRequest: vi.fn().mockResolvedValue({
        quote: {
          subtotal_minor: 100000,
          discount_minor: 5000,
          total_minor: 95000,
          currency: 'NGN',
          lead_time_days: 3,
        },
        lines: [
          {
            position: 1,
            sku_id: 'sku-1',
            description: 'M6 Hex Bolt',
            quantity: 100,
            unit_price_minor: 950,
            amount_minor: 95000,
          },
        ],
      }),
    };
    attachmentsService = {
      listForRequest: vi.fn().mockResolvedValue([
        {
          id: 'att-1',
          filename: 'rfq.pdf',
          mime_type: 'application/pdf',
          size_bytes: 10,
          parse_status: 'unparsed',
          parse_error_reason: null,
          created_at: new Date(),
        },
      ]),
    };
    service = new RequestsService(
      modelAction as RequestModelAction,
      lineItems as LineItemModelAction,
      quotes as QuoteModelAction,
      attachmentsService as AttachmentsService,
    );
  });

  describe('listForOrg', () => {
    it('scopes by org, sorts newest-first with an id tie-breaker, and maps to the summary shape', async () => {
      const result = await service.listForOrg({ orgId: 'org-1', page: 1, limit: 50 });

      expect(modelAction.list).toHaveBeenCalledWith({
        filterRecordOptions: { org_id: 'org-1' },
        paginationPayload: { page: 1, limit: 50 },
        order: { created_at: 'DESC', id: 'DESC' },
      });
      const row = result.payload[0];
      expect(row).toEqual({
        id: 'req-1',
        sender_company: 'Apex',
        sender_contact: 'Dana',
        source_subject: 'RFQ',
        request_type: 'catalog_rfq',
        overall_confidence: 0.96,
        status: 'needs_review',
        created_at: mockRequest.created_at,
      });
      // Summary must not leak detail/internal fields.
      expect(row).not.toHaveProperty('sender_email');
      expect(row).not.toHaveProperty('source_body');
      expect(row).not.toHaveProperty('org_id');
    });

    it('does not scope when orgId is undefined (single-tenant dev)', async () => {
      await service.listForOrg({ page: 1, limit: 50 });
      expect(modelAction.list).toHaveBeenCalledWith(
        expect.objectContaining({ filterRecordOptions: undefined }),
      );
    });
  });

  describe('getDetail', () => {
    it('composes the detail with attachments and exposes only the read-model fields', async () => {
      const detail = await service.getDetail(mockRequest);

      expect(attachmentsService.listForRequest).toHaveBeenCalledWith('req-1');
      expect(detail.sender_email).toBe('dana@apex.example');
      expect(detail.source_body).toBe('please quote');
      expect(detail.current_node).toBe('extract');
      expect(detail.attachments).toHaveLength(1);
      // Internal attachment fields must never appear in the detail.
      expect(detail.attachments[0]).not.toHaveProperty('storage_url');
      expect(detail.attachments[0]).not.toHaveProperty('parsed_text');
      expect(detail).not.toHaveProperty('org_id');
    });

    it('includes parsed line items (with matched SKU + flags) and the suggested quote (US-E6-1)', async () => {
      const detail = await service.getDetail(mockRequest);

      expect(detail.line_items).toHaveLength(1);
      expect(detail.line_items[0]).toMatchObject({
        position: 1,
        match_confidence: 0.62,
        matched_sku: { sku_code: 'SKU-061', name: 'M6 Hex Bolt' },
        flags: ['close_tie'],
      });
      expect(detail.quote).toMatchObject({ total_minor: 95000, currency: 'NGN' });
      expect(detail.quote?.lines[0]).toMatchObject({ amount_minor: 95000 });
    });

    it('returns a null quote when the request has not been priced yet (EC-01)', async () => {
      (quotes.getForRequest as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
      const detail = await service.getDetail(mockRequest);
      expect(detail.quote).toBeNull();
      expect(detail.line_items).toHaveLength(1);
    });
  });
});
