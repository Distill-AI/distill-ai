import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { of } from 'rxjs';
import { RequestsController } from '../controllers/requests.controller';
import { RequestsService } from '../services/requests.service';
import { StreamService } from '../services/stream.service';
import type { Request as RequestEntity } from '../entities/request.entity';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';

describe('RequestsController', () => {
  let controller: RequestsController;
  let requestsService: RequestsService;
  let streamService: StreamService;

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RequestsController],
      providers: [
        {
          provide: RequestsService,
          useValue: {
            findById: vi.fn().mockResolvedValue(mockRequest),
            findByIdOrFail: vi.fn().mockResolvedValue(mockRequest),
          },
        },
        {
          provide: StreamService,
          useValue: {
            subscribe: vi.fn().mockReturnValue(mockStream),
          },
        },
      ],
    }).compile();

    controller = module.get<RequestsController>(RequestsController);
    requestsService = module.get<RequestsService>(RequestsService);
    streamService = module.get<StreamService>(StreamService);
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
});
