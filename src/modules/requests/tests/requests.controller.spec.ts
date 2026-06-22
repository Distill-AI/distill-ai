import { NotFoundException } from '@nestjs/common';
import { of } from 'rxjs';
import { RequestsController } from '../controllers/requests.controller';
import { RequestsService } from '../services/requests.service';
import { StreamService } from '../services/stream.service';
import { RequestActions } from '../actions/request.actions';
import { ResumeReason } from '../enums/resume-reason.enum';
import { CurrentNode } from '../enums/current-node.enum';
import type { Request as RequestEntity } from '../entities/request.entity';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';

vi.mock('@config/auth.config', () => ({ authConfig: { enabled: true } }));

describe('RequestsController', () => {
  let controller: RequestsController;
  let requestsService: Partial<RequestsService>;
  let streamService: Partial<StreamService>;
  let requestActions: Partial<RequestActions>;

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
    current_node: CurrentNode.EXTRACT,
  };

  const mockStream = of({ type: 'node.entered', data: { request_id: 'req-1', node: 'parse' } });

  beforeEach(() => {
    requestsService = {
      findById: vi.fn().mockResolvedValue(mockRequest),
      findByIdOrFail: vi.fn().mockResolvedValue(mockRequest),
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
    };
    controller = new RequestsController(
      requestsService as RequestsService,
      streamService as StreamService,
      requestActions as RequestActions,
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
      expect(requestActions.resumeRequest).toHaveBeenCalledWith('req-1', ResumeReason.MANUAL);
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
      );

      const start = Date.now();
      await controller.resume('req-1', { user: mockUser });
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(1000);
    });
  });
});
