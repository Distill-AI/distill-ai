import type { DataSource } from 'typeorm';
import type { Response } from 'express';

const mockAuthConfig = vi.hoisted(() => ({ enabled: false }));
vi.mock('@config/auth.config', () => ({ authConfig: mockAuthConfig }));

import { RlsContextMiddleware } from '../middleware/rls-context.middleware';
import type { AuthService } from '../services/auth.service';

function makeQueryRunner() {
  const qr = {
    isReleased: false,
    connect: vi.fn().mockResolvedValue(undefined),
    startTransaction: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue(undefined),
    commitTransaction: vi.fn().mockResolvedValue(undefined),
    rollbackTransaction: vi.fn().mockResolvedValue(undefined),
    release: vi.fn().mockImplementation(() => {
      qr.isReleased = true;
      return Promise.resolve();
    }),
    manager: {},
  };
  return qr;
}

function makeResponse() {
  const handlers: Record<string, () => Promise<void> | void> = {};
  return {
    statusCode: 200,
    on(event: string, cb: () => Promise<void> | void) {
      handlers[event] = cb;
    },
    async emit(event: string) {
      await handlers[event]?.();
    },
  };
}

function build() {
  const qr = makeQueryRunner();
  const dataSource = { createQueryRunner: () => qr } as unknown as DataSource;
  const middleware = new RlsContextMiddleware(dataSource, {} as unknown as AuthService);
  return { middleware, qr };
}

describe('RlsContextMiddleware', () => {
  beforeEach(() => {
    mockAuthConfig.enabled = false;
  });

  it('exposes an empty afterCommit queue and calls next', async () => {
    const { middleware } = build();
    const req: Record<string, unknown> = {};
    const next = vi.fn();

    await middleware.use(req, makeResponse() as unknown as Response, next);

    expect(req.afterCommit).toEqual([]);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('commits and runs after-commit tasks on a 2xx response', async () => {
    const { middleware, qr } = build();
    const req: Record<string, unknown> = {};
    const res = makeResponse();
    await middleware.use(req, res as unknown as Response, vi.fn());

    const task = vi.fn().mockResolvedValue(undefined);
    (req.afterCommit as Array<() => Promise<void>>).push(task);
    await res.emit('finish');

    expect(qr.commitTransaction).toHaveBeenCalledTimes(1);
    expect(qr.rollbackTransaction).not.toHaveBeenCalled();
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('rolls back and skips after-commit tasks on a 4xx response', async () => {
    const { middleware, qr } = build();
    const req: Record<string, unknown> = {};
    const res = makeResponse();
    await middleware.use(req, res as unknown as Response, vi.fn());

    const task = vi.fn().mockResolvedValue(undefined);
    (req.afterCommit as Array<() => Promise<void>>).push(task);
    res.statusCode = 400;
    await res.emit('finish');

    expect(qr.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(qr.commitTransaction).not.toHaveBeenCalled();
    expect(task).not.toHaveBeenCalled();
  });

  it('isolates a failing after-commit task so the rest still run', async () => {
    const { middleware } = build();
    const req: Record<string, unknown> = {};
    const res = makeResponse();
    await middleware.use(req, res as unknown as Response, vi.fn());

    const bad = vi.fn().mockRejectedValue(new Error('redis down'));
    const good = vi.fn().mockResolvedValue(undefined);
    (req.afterCommit as Array<() => Promise<void>>).push(bad, good);

    await expect(res.emit('finish')).resolves.toBeUndefined();
    expect(bad).toHaveBeenCalledTimes(1);
    expect(good).toHaveBeenCalledTimes(1);
  });
});
