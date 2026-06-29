import { Not, In } from 'typeorm';
import { RequestStatus } from '../enums/request-status.enum';
import { RequestModelAction } from '../requests.model-action';

function setup() {
  const repository = {
    update: vi.fn().mockResolvedValue({ affected: 1 }),
  };
  const action = new RequestModelAction(repository as never);
  return { action, repository };
}

describe('RequestModelAction.trySetStatus', () => {
  it('uses Not(status) when no validSources are given', async () => {
    const { action, repository } = setup();

    const result = await action.trySetStatus('req-1', RequestStatus.PARSING);

    expect(repository.update).toHaveBeenCalledWith(
      { id: 'req-1', status: Not(RequestStatus.PARSING) },
      { status: RequestStatus.PARSING },
    );
    expect(result).toBe(true);
  });

  it('uses In(validSources) when validSources are given', async () => {
    const { action, repository } = setup();

    const result = await action.trySetStatus('req-1', RequestStatus.DECLINED, [
      RequestStatus.NEEDS_REVIEW,
      RequestStatus.PRICED,
    ]);

    expect(repository.update).toHaveBeenCalledWith(
      { id: 'req-1', status: In([RequestStatus.NEEDS_REVIEW, RequestStatus.PRICED]) },
      { status: RequestStatus.DECLINED },
    );
    expect(result).toBe(true);
  });

  it('returns false when affected is 0', async () => {
    const { action, repository } = setup();
    repository.update.mockResolvedValue({ affected: 0 });

    const result = await action.trySetStatus('req-1', RequestStatus.DECLINED);

    expect(result).toBe(false);
  });

  it('returns false when affected is undefined', async () => {
    const { action, repository } = setup();
    repository.update.mockResolvedValue({});

    const result = await action.trySetStatus('req-1', RequestStatus.DECLINED);

    expect(result).toBe(false);
  });
});
