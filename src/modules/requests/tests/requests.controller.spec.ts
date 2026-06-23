import { NotFoundException } from '@nestjs/common';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import { of } from 'rxjs';
import { RequestsController } from '../controllers/requests.controller';
import { RequestsService } from '../services/requests.service';
import { StreamService } from '../services/stream.service';
import { AttachmentsService } from '../services/attachments.service';
import type { Request as RequestEntity } from '../entities/request.entity';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';

vi.mock('@config/auth.config', () => ({ authConfig: { enabled: true } }));

describe('RequestsController', () => {
  let controller: RequestsController;
  let requestsService: Partial<RequestsService>;
  let streamService: Partial<StreamService>;
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
    status: 'parsing',
    current_node: 'parse',
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
    };
    streamService = {
      subscribe: vi.fn().mockReturnValue(mockStream),
    };
    attachmentsService = {
      getForDownload: vi.fn().mockResolvedValue({
        attachment: {
          id: 'att-1',
          request_id: 'req-1',
          filename: 'rfq.pdf',
          mime_type: 'application/pdf',
          // Deliberately wrong vs the real payload, to prove Content-Length uses bytes.length.
          size_bytes: 999,
          storage_url: 'attachments/req-1/rfq.pdf',
        },
        bytes: Buffer.from('PDF-BYTES'),
      }),
    };
    controller = new RequestsController(
      requestsService as RequestsService,
      streamService as StreamService,
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

  describe('downloadAttachment', () => {
    it('streams the bytes with the stored mime type and a download filename', async () => {
      const res = makeRes();
      await controller.downloadAttachment('req-1', 'att-1', { user: mockUser }, res);

      expect(attachmentsService.getForDownload).toHaveBeenCalledWith('req-1', 'att-1');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      // 9 = Buffer.from('PDF-BYTES').length, NOT the (deliberately wrong) size_bytes of 999.
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
