import { HttpException, HttpStatus } from '@nestjs/common';
import { RequestActions } from '../actions/request.actions';
import { RequestStatus } from '../enums/request-status.enum';
import type { RequestModelAction } from '../requests.model-action';
import type { EventsService } from '@modules/events/events.service';
import type { Request } from '../entities/request.entity';

function setup(
  overrides?: Partial<{
    trySetStatus: boolean;
    getStatus: RequestStatus | null;
    emitError: Error | null;
  }>,
) {
  const { trySetStatus = true, getStatus = null, emitError = null } = overrides ?? {};

  const requestModelAction = {
    trySetStatus: vi.fn().mockResolvedValue(trySetStatus),
    get: vi.fn().mockResolvedValue(getStatus ? { status: getStatus } : null),
  } as unknown as RequestModelAction;

  const eventsService = {
    emit: emitError ? vi.fn().mockRejectedValue(emitError) : vi.fn().mockResolvedValue(undefined),
  } as unknown as EventsService;

  const nodeRecovery = {} as never;
  const extractionActions = {} as never;

  const service = new RequestActions(
    nodeRecovery,
    extractionActions,
    requestModelAction,
    eventsService,
  );

  const request = {
    id: 'req-1',
    org_id: 'org-1',
    status: RequestStatus.NEEDS_REVIEW,
  } as Request;

  return { service, request, requestModelAction, eventsService };
}

describe('RequestActions.declineRequest', () => {
  it('declines the request and fires the audit event on first call', async () => {
    const { service, request, requestModelAction, eventsService } = setup({ trySetStatus: true });

    const result = await service.declineRequest(request, 'Not relevant', 'user-1');

    expect(requestModelAction.trySetStatus).toHaveBeenCalledWith('req-1', RequestStatus.DECLINED, [
      RequestStatus.NEEDS_REVIEW,
      RequestStatus.NEEDS_CLARIFICATION,
      RequestStatus.PRICED,
      RequestStatus.READY,
      RequestStatus.FAILED,
    ]);
    expect(eventsService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'request.declined',
        requestId: 'req-1',
        attributes: { reason: 'Not relevant' },
      }),
    );
    expect(result).toEqual({
      request_id: 'req-1',
      status: RequestStatus.DECLINED,
      reason: 'Not relevant',
    });
  });

  it('returns idempotent success when the request is already declined without calling emit', async () => {
    const { service, request, requestModelAction, eventsService } = setup({
      trySetStatus: false,
      getStatus: RequestStatus.DECLINED,
    });

    const result = await service.declineRequest(request, 'Already done', 'user-1');

    expect(requestModelAction.get).toHaveBeenCalledWith({
      identifierOptions: { id: 'req-1' },
    });
    expect(eventsService.emit).not.toHaveBeenCalled();
    expect(result).toEqual({
      request_id: 'req-1',
      status: RequestStatus.DECLINED,
      reason: 'Already done',
    });
  });

  it('throws ConflictException when the request is not in a declinable state', async () => {
    const { service, request } = setup({
      trySetStatus: false,
      getStatus: RequestStatus.PARSING,
    });

    await expect(service.declineRequest(request, 'Cannot decline', 'user-1')).rejects.toThrow(
      new HttpException(
        `Request req-1 cannot be declined from its current status`,
        HttpStatus.CONFLICT,
      ),
    );
  });

  it('propagates an emit error after a successful status transition', async () => {
    const emitError = new Error('DB connection lost');
    const { service, request, requestModelAction, eventsService } = setup({
      trySetStatus: true,
      emitError,
    });

    await expect(service.declineRequest(request, 'Reason', 'user-1')).rejects.toThrow(
      'DB connection lost',
    );

    expect(requestModelAction.trySetStatus).toHaveBeenCalledWith(
      'req-1',
      RequestStatus.DECLINED,
      expect.any(Array),
    );
    expect(eventsService.emit).toHaveBeenCalled();
  });
});
