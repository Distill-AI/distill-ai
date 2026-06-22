import { RequestActions } from '../actions/request.actions';
import { ResumeReason } from '../enums/resume-reason.enum';
import type { RequestModelAction } from '../requests.model-action';
import type { NodeRecoveryActions } from '../../pipeline/node-recovery.actions';
import type { EventsService } from '../../events/events.service';
import type { Request } from '../entities/request.entity';
import { CurrentNode } from '../enums/current-node.enum';
import { RequestStatus } from '../enums/request-status.enum';

describe('RequestActions', () => {
  let actions: RequestActions;
  let mockModelAction: Partial<RequestModelAction>;
  let mockNodeRecovery: Partial<NodeRecoveryActions>;
  let mockEvents: Partial<EventsService>;

  const mockRequest = {
    id: 'req-1',
    org_id: 'org-1',
    current_node: CurrentNode.EXTRACT,
    status: RequestStatus.PARSING,
    channel: 'email',
    request_type: 'unknown',
    routing: null,
    routing_reasons: [],
    overall_confidence: null,
    classification_confidence: null,
    delivery_date: null,
    source_subject: null,
    source_body: null,
    sender_company: null,
    sender_contact: null,
    sender_email: null,
    processing_started_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  } as Request;

  beforeEach(() => {
    mockModelAction = {
      get: vi.fn(),
    };
    mockNodeRecovery = {
      resumeFromCurrentNode: vi.fn().mockResolvedValue(undefined),
    };
    mockEvents = {
      emit: vi.fn().mockResolvedValue(undefined),
    };
    actions = new RequestActions(
      mockModelAction as RequestModelAction,
      mockNodeRecovery as NodeRecoveryActions,
      mockEvents as EventsService,
    );
  });

  describe('getRequestByIdWithNode', () => {
    it('returns the request when found', async () => {
      mockModelAction.get = vi.fn().mockResolvedValue(mockRequest);

      const result = await actions.getRequestByIdWithNode('req-1');

      expect(result).toBe(mockRequest);
      expect(mockModelAction.get).toHaveBeenCalledWith({
        identifierOptions: { id: 'req-1' },
      });
    });

    it('returns null when not found', async () => {
      mockModelAction.get = vi.fn().mockResolvedValue(null);

      const result = await actions.getRequestByIdWithNode('req-404');

      expect(result).toBeNull();
    });
  });

  describe('resumeRequest', () => {
    it('returns resumed=false when request not found', async () => {
      mockModelAction.get = vi.fn().mockResolvedValue(null);

      const result = await actions.resumeRequest('req-404', ResumeReason.MANUAL);

      expect(result.resumed).toBe(false);
      expect(result.resume_reason).toBe(ResumeReason.MANUAL);
      expect(mockNodeRecovery.resumeFromCurrentNode).not.toHaveBeenCalled();
    });

    it('enqueues pipeline via nodeRecovery when request exists (FR: Manual resume)', async () => {
      mockModelAction.get = vi.fn().mockResolvedValue(mockRequest);

      const result = await actions.resumeRequest('req-1', ResumeReason.MANUAL);

      expect(mockNodeRecovery.resumeFromCurrentNode).toHaveBeenCalledWith(
        'req-1',
        ResumeReason.MANUAL,
      );
      expect(result.resumed).toBe(true);
      expect(result.resume_reason).toBe(ResumeReason.MANUAL);
      expect(result.current_node).toBe(CurrentNode.EXTRACT);
    });

    it('emits request.resumed event with reason (FR: Event emission)', async () => {
      mockModelAction.get = vi.fn().mockResolvedValue(mockRequest);

      await actions.resumeRequest('req-1', ResumeReason.MANUAL);

      expect(mockEvents.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'request.resumed',
          requestId: 'req-1',
          attributes: expect.objectContaining({
            reason: ResumeReason.MANUAL,
            resumed_from_node: CurrentNode.EXTRACT,
          }),
        }),
      );
    });

    it('handles crash_recovery reason correctly', async () => {
      mockModelAction.get = vi.fn().mockResolvedValue(mockRequest);

      const result = await actions.resumeRequest('req-1', ResumeReason.CRASH_RECOVERY);

      expect(result.resume_reason).toBe(ResumeReason.CRASH_RECOVERY);
      expect(mockNodeRecovery.resumeFromCurrentNode).toHaveBeenCalledWith(
        'req-1',
        ResumeReason.CRASH_RECOVERY,
      );
    });

    it('returns correct current_node from persisted request', async () => {
      const classifyRequest = {
        ...mockRequest,
        current_node: CurrentNode.CLASSIFY,
      };
      mockModelAction.get = vi.fn().mockResolvedValue(classifyRequest);

      const result = await actions.resumeRequest('req-1', ResumeReason.MANUAL);

      expect(result.current_node).toBe(CurrentNode.CLASSIFY);
    });
  });
});
