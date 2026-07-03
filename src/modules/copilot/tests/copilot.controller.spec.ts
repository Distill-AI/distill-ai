import { NotFoundException } from '@nestjs/common';
import * as SYS_MSG from '@constants/system-messages';
import { CopilotController } from '../copilot.controller';
import { CopilotService } from '../copilot.service';
import { RequestsService } from '../../requests/services/requests.service';
import type { Request as RequestEntity } from '../../requests/entities/request.entity';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';

vi.mock('@config/auth.config', () => ({ authConfig: { enabled: true } }));

describe('CopilotController', () => {
  let controller: CopilotController;
  let requestsService: Partial<RequestsService>;
  let copilotService: Partial<CopilotService>;

  const mockUser: AuthUser = {
    userId: 'user-1',
    orgId: 'org-1',
    roles: ['estimator'],
    email: 'estimator@example.com',
  };

  beforeEach(() => {
    requestsService = { findByIdOrFail: vi.fn() };
    copilotService = { getExplanation: vi.fn() };
    controller = new CopilotController(
      requestsService as RequestsService,
      copilotService as CopilotService,
    );
  });

  it('returns the explanation envelope for a same-org request', async () => {
    const request = { id: 'req-1', org_id: 'org-1' } as RequestEntity;
    (requestsService.findByIdOrFail as ReturnType<typeof vi.fn>).mockResolvedValue(request);
    (copilotService.getExplanation as ReturnType<typeof vi.fn>).mockResolvedValue({
      explanation: 'text',
      degraded: false,
    });

    const result = await controller.getExplanation('req-1', { user: mockUser });

    expect(result).toEqual({
      statusCode: 200,
      message: SYS_MSG.COPILOT_EXPLANATION_RETRIEVED,
      data: { explanation: 'text', degraded: false },
    });
  });

  it('404s a cross-org request without calling CopilotService', async () => {
    const request = { id: 'req-1', org_id: 'org-2' } as RequestEntity;
    (requestsService.findByIdOrFail as ReturnType<typeof vi.fn>).mockResolvedValue(request);

    await expect(controller.getExplanation('req-1', { user: mockUser })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(copilotService.getExplanation).not.toHaveBeenCalled();
  });
});
