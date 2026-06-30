import { NotFoundException } from '@nestjs/common';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import { of } from 'rxjs';
import { RequestsController } from '../controllers/requests.controller';
import { RequestsService } from '../services/requests.service';
import { StreamService } from '../services/stream.service';
import { RequestActions } from '../actions/request.actions';
import { LineItemRemapActions } from '../actions/line-item-remap.actions';
import { ResumeReason } from '../enums/resume-reason.enum';
import { RequestStatus } from '../enums/request-status.enum';
import { CurrentNode } from '../enums/current-node.enum';
import { DeclineRequestDto } from '../dto/decline-request.dto';
import { PatchLineItemDto } from '../dto/patch-line-item.dto';
import { AttachmentsService } from '../services/attachments.service';
import type { Request as RequestEntity } from '../entities/request.entity';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';

vi.mock('@config/auth.config', () => ({ authConfig: { enabled: true } }));

describe('RequestsController', () => {
  let controller: RequestsController;
  let requestsService: Partial<RequestsService>;
  let streamService: Partial<StreamService>;
  let requestActions: Partial<RequestActions>;
  let lineItemRemapActions: Partial<LineItemRemapActions>;
  let attachmentsService: Partial<AttachmentsService>;

  const mockUser: AuthUser = {
    userId: 'user-1',
    orgId: 'org-1',
    roles: ['estimator'],
    email: 'estimator@example.com',
  };

  const mockRequest = {
    id: 'req-1',
    org_id: 'org-1',
    status: 'parsing' as RequestStatus,
    current_node: CurrentNode.EXTRACT,
  };

  const mockStream = of({ type: 'node.entered', data: { request_id: 'req-1', node: 'parse' } });

  function makeRes() {
    return {
      setHeader: vi.fn(),
      send: vi.fn(),
    } as unknown as import('express').Response & {
      setHeader: ReturnType<typeof vi.fn>;
      send: ReturnType<typeof vi.fn>;
    };
  }

  beforeEach(() => {
    requestsService = {
      findById: vi.fn().mockResolvedValue(mockRequest),
      findByIdOrFail: vi.fn().mockResolvedValue(mockRequest),
      listForOrg: vi.fn().mockResolvedValue({
        payload: [{ id: 'req-1', sender_company: 'Apex', status: 'needs_review' }],
        paginationMeta: {
          total: 1,
          limit: 50,
          page: 1,
          total_pages: 1,
          has_next: false,
          has_previous: false,
        },
      }),
      getDetail: vi.fn().mockResolvedValue({
        id: 'req-1',
        sender_company: 'Apex',
        attachments: [{ id: 'att-1', filename: 'rfq.pdf' }],
      }),
    };
    streamService = {
      subscribe: vi.fn().mockReturnValue(mockStream),
    };
    requestActions = {
      resumeRequest: vi.fn().mockResolvedValue({
        request_id: 'req-1',
        resumed: true,
        resume_reason: ResumeReason.MANUAL,
        current_node: CurrentNode.EXTRACT,
      }),
      declineRequest: vi.fn().mockResolvedValue({
        request_id: 'req-1',
        status: RequestStatus.DECLINED,
        reason: 'Not a relevant request',
      }),
    };
    lineItemRemapActions = {
      remap: vi.fn().mockResolvedValue({
        request_id: 'req-1',
        line: {
          id: 'li-1',
          matched_sku_id: 'sku-new',
          quantity: 100,
          unit_price_minor: 900,
          match_confidence: 1,
        },
        quote: {
          quote_id: 'quote-1',
          subtotal_minor: 100000,
          discount_minor: 10000,
          total_minor: 90000,
          lead_time_days: 7,
          blocked: false,
        },
      }),
    };
    attachmentsService = {
      getForDownload: vi.fn().mockResolvedValue({
        attachment: {
          id: 'att-1',
          request_id: 'req-1',
          filename: 'rfq.pdf',
          mime_type: 'application/pdf',
          size_bytes: 999,
          storage_url: 'attachments/req-1/rfq.pdf',
        },
        bytes: Buffer.from('PDF-BYTES'),
      }),
    };
    controller = new RequestsController(
      requestsService as RequestsService,
      streamService as StreamService,
      requestActions as RequestActions,
      lineItemRemapActions as LineItemRemapActions,
      attachmentsService as AttachmentsService,
    );
  });

  describe('events (SSE endpoint)', () => {
    it('returns an Observable when request exists and org matches', async () => {
      const result = await controller.events('req-1', { user: mockUser });
      expect(result).toBe(mockStream);
      expect(streamService.subscribe).toHaveBeenCalledWith('req-1');
    });

    it('throws NotFoundException when request is not found', async () => {
      vi.spyOn(requestsService, 'findByIdOrFail').mockRejectedValueOnce(
        new NotFoundException('Request req-404 not found'),
      );

      await expect(controller.events('req-404', { user: mockUser })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when org_id does not match (RLS)', async () => {
      const wrongOrgReq = { ...mockRequest, org_id: 'org-2' } as RequestEntity;
      vi.spyOn(requestsService, 'findByIdOrFail').mockResolvedValueOnce(wrongOrgReq);

      await expect(controller.events('req-1', { user: mockUser })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when user has no orgId', async () => {
      await expect(controller.events('req-1', { user: undefined })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('resume (POST /:id/resume)', () => {
    it('resumes from current_node and emits request.resumed(reason=manual) (AC: Manual resume)', async () => {
      const result = await controller.resume('req-1', { user: mockUser });

      expect(result.statusCode).toBe(200);
      expect(result.message).toBeDefined();
      expect(result.data.resumed).toBe(true);
      expect(result.data.resume_reason).toBe(ResumeReason.MANUAL);
      expect(result.data.current_node).toBe(CurrentNode.EXTRACT);
      expect(requestActions.resumeRequest).toHaveBeenCalledWith(mockRequest, ResumeReason.MANUAL);
    });

    it('throws NotFoundException when request does not exist', async () => {
      vi.spyOn(requestsService, 'findByIdOrFail').mockRejectedValueOnce(
        new NotFoundException('Request req-404 not found'),
      );

      await expect(controller.resume('req-404', { user: mockUser })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when org_id does not match (RLS)', async () => {
      const wrongOrgReq = { ...mockRequest, org_id: 'org-2' } as RequestEntity;
      vi.spyOn(requestsService, 'findByIdOrFail').mockResolvedValueOnce(wrongOrgReq);

      await expect(controller.resume('req-1', { user: mockUser })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when user has no orgId', async () => {
      await expect(controller.resume('req-1', { user: undefined })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('responds within 1 second for healthy requests (AC: 1s response time)', async () => {
      requestActions.resumeRequest = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  request_id: 'req-1',
                  resumed: true,
                  resume_reason: ResumeReason.MANUAL,
                  current_node: CurrentNode.EXTRACT,
                }),
              50,
            ),
          ),
      );
      controller = new RequestsController(
        requestsService as RequestsService,
        streamService as StreamService,
        requestActions as RequestActions,
        attachmentsService as AttachmentsService,
      );

      const start = Date.now();
      await controller.resume('req-1', { user: mockUser });
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(1000);
    });
  });

  describe('decline (POST /:id/decline)', () => {
    const dto = new DeclineRequestDto();
    dto.reason = 'Not a relevant request';

    it('declines a request with a reason and returns the declined status (AC-01, AC-02)', async () => {
      const result = await controller.decline('req-1', dto, { user: mockUser });

      expect(result.statusCode).toBe(200);
      expect(result.message).toBeDefined();
      expect(result.data.status).toBe(RequestStatus.DECLINED);
      expect(result.data.reason).toBe('Not a relevant request');
      expect(result.data.request_id).toBe('req-1');
      expect(requestActions.declineRequest).toHaveBeenCalledWith(
        mockRequest,
        'Not a relevant request',
        'user-1',
      );
    });

    it('throws NotFoundException when request does not exist', async () => {
      vi.spyOn(requestsService, 'findByIdOrFail').mockRejectedValueOnce(
        new NotFoundException('Request req-404 not found'),
      );

      await expect(controller.decline('req-404', dto, { user: mockUser })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when org_id does not match (RLS, SEC-01)', async () => {
      const wrongOrgReq = { ...mockRequest, org_id: 'org-2' } as RequestEntity;
      vi.spyOn(requestsService, 'findByIdOrFail').mockResolvedValueOnce(wrongOrgReq);

      await expect(controller.decline('req-1', dto, { user: mockUser })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when user has no orgId (SEC-01)', async () => {
      await expect(controller.decline('req-1', dto, { user: undefined })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('declining an already-declined request is idempotent (EC-01)', async () => {
      const alreadyDeclined = { ...mockRequest, status: RequestStatus.DECLINED } as RequestEntity;
      vi.spyOn(requestsService, 'findByIdOrFail').mockResolvedValueOnce(alreadyDeclined);

      const result = await controller.decline('req-1', dto, { user: mockUser });

      expect(result.statusCode).toBe(200);
      expect(result.data.status).toBe(RequestStatus.DECLINED);
    });
  });

  describe('remap line item (PATCH /:id/line-items/:lineId)', () => {
    const dto: PatchLineItemDto = { sku_id: 'sku-new' };

    it('re-maps the line and returns the server-confirmed totals (AC-01, AC-02)', async () => {
      const result = await controller.remapLineItem('req-1', 'li-1', dto, { user: mockUser });

      expect(result.statusCode).toBe(200);
      expect(result.data.quote.total_minor).toBe(90000);
      expect(result.data.line.match_confidence).toBe(1);
      expect(lineItemRemapActions.remap).toHaveBeenCalledWith(mockRequest, 'li-1', dto);
    });

    it('throws NotFoundException when the org_id does not match (SEC-01)', async () => {
      const wrongOrgReq = { ...mockRequest, org_id: 'org-2' } as RequestEntity;
      vi.spyOn(requestsService, 'findByIdOrFail').mockResolvedValueOnce(wrongOrgReq);

      await expect(
        controller.remapLineItem('req-1', 'li-1', dto, { user: mockUser }),
      ).rejects.toThrow(NotFoundException);
      expect(lineItemRemapActions.remap).not.toHaveBeenCalled();
    });
  });

  describe('list (GET /requests)', () => {
    it('returns the org-scoped, paginated list with defaults', async () => {
      const result = await controller.list({ user: mockUser });

      expect(requestsService.listForOrg).toHaveBeenCalledWith({
        orgId: 'org-1',
        page: 1,
        limit: 50,
      });
      expect(result.statusCode).toBe(200);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('clamps page and limit from the query string', async () => {
      await controller.list({ user: mockUser }, '3', '500');

      expect(requestsService.listForOrg).toHaveBeenCalledWith({
        orgId: 'org-1',
        page: 3,
        limit: 100,
      });
    });

    it('clamps out-of-range and defaults non-numeric query values', async () => {
      // 'abc' is non-numeric -> default page 1; '-5' is a valid but out-of-range integer -> clamp to 1
      await controller.list({ user: mockUser }, 'abc', '-5');

      expect(requestsService.listForOrg).toHaveBeenCalledWith({
        orgId: 'org-1',
        page: 1,
        limit: 1,
      });
    });

    it('fails closed with an empty list when auth is on and the caller has no orgId', async () => {
      const result = await controller.list({
        user: { userId: 'u', roles: [], email: 'e' } as AuthUser,
      });

      expect(requestsService.listForOrg).not.toHaveBeenCalled();
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('getOne (GET /requests/:id)', () => {
    it('returns the request detail when org matches', async () => {
      const result = await controller.getOne('req-1', { user: mockUser });

      expect(requestsService.getDetail).toHaveBeenCalledWith(mockRequest);
      expect(result.statusCode).toBe(200);
      expect(result.data.id).toBe('req-1');
      expect(result.data.attachments).toHaveLength(1);
    });

    it('throws NotFoundException when the request is not found', async () => {
      vi.spyOn(requestsService, 'findByIdOrFail').mockRejectedValueOnce(
        new NotFoundException('Request req-404 not found'),
      );

      await expect(controller.getOne('req-404', { user: mockUser })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('404s for a cross-org request and never builds the detail', async () => {
      const otherOrg = { ...mockRequest, org_id: 'org-2' } as RequestEntity;
      vi.spyOn(requestsService, 'findByIdOrFail').mockResolvedValueOnce(otherOrg);

      await expect(controller.getOne('req-1', { user: mockUser })).rejects.toThrow(
        NotFoundException,
      );
      expect(requestsService.getDetail).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an authenticated user without an orgId', async () => {
      await expect(
        controller.getOne('req-1', { user: { userId: 'u', roles: [], email: 'e' } as AuthUser }),
      ).rejects.toThrow(NotFoundException);
      expect(requestsService.getDetail).not.toHaveBeenCalled();
    });
  });

  describe('downloadAttachment', () => {
    it('streams the bytes with the stored mime type and a download filename', async () => {
      const res = makeRes();
      await controller.downloadAttachment('req-1', 'att-1', { user: mockUser }, res);

      expect(attachmentsService.getForDownload).toHaveBeenCalledWith('req-1', 'att-1');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Length', 9);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        "attachment; filename*=UTF-8''rfq.pdf",
      );
      expect(res.send).toHaveBeenCalledWith(Buffer.from('PDF-BYTES'));
    });

    it('404s and serves nothing when the request is not found', async () => {
      const res = makeRes();
      vi.spyOn(requestsService, 'findByIdOrFail').mockRejectedValueOnce(
        new NotFoundException('Request req-404 not found'),
      );

      await expect(
        controller.downloadAttachment('req-404', 'att-1', { user: mockUser }, res),
      ).rejects.toThrow(NotFoundException);
      expect(attachmentsService.getForDownload).not.toHaveBeenCalled();
      expect(res.send).not.toHaveBeenCalled();
    });

    it('404s when the request belongs to another org and never reads the attachment', async () => {
      const res = makeRes();
      const otherOrg = { ...mockRequest, org_id: 'org-2' } as RequestEntity;
      vi.spyOn(requestsService, 'findByIdOrFail').mockResolvedValueOnce(otherOrg);

      await expect(
        controller.downloadAttachment('req-1', 'att-1', { user: mockUser }, res),
      ).rejects.toThrow(CustomHttpException);
      expect(attachmentsService.getForDownload).not.toHaveBeenCalled();
    });

    it('propagates a 404 when the attachment is missing', async () => {
      const res = makeRes();
      vi.spyOn(attachmentsService, 'getForDownload').mockRejectedValueOnce(
        new CustomHttpException('Attachment att-404 not found', 404),
      );

      await expect(
        controller.downloadAttachment('req-1', 'att-404', { user: mockUser }, res),
      ).rejects.toThrow(CustomHttpException);
      expect(res.send).not.toHaveBeenCalled();
    });
  });
});
