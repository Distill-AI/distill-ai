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

describe('RequestModelAction.findStaleParsing', () => {
  function qbSetup() {
    const rows = [{ id: 'r1' }];
    const qb = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue(rows),
    };
    const repository = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
    const action = new RequestModelAction(repository as never);
    return { action, qb, rows };
  }

  it('scopes to parsing and checks staleness against the DB clock (both branches)', async () => {
    const { action, qb, rows } = qbSetup();

    const result = await action.findStaleParsing(120);

    expect(qb.where).toHaveBeenCalledWith('request.status = :status', {
      status: RequestStatus.PARSING,
    });
    const [sql, params] = qb.andWhere.mock.calls[0];
    // DB-side age (NOW()), not a caller-computed cutoff, so worker/DB clock skew can't mislead it.
    expect(sql).toContain('NOW() - make_interval(secs => :secs)');
    // Started-then-stalled branch.
    expect(sql).toContain('request.processing_started_at < NOW()');
    // Intake-stranded branch: null processing_started_at, bounded by created_at.
    expect(sql).toContain('request.processing_started_at IS NULL');
    expect(sql).toContain('request.created_at < NOW()');
    expect(params).toEqual({ secs: 120 });
    expect(result).toBe(rows);
  });
});
