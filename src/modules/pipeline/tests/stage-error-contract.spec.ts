import { CurrentNode } from '@modules/requests/enums/current-node.enum';
import { RequestStatus } from '@modules/requests/enums/request-status.enum';
import type { Request } from '@modules/requests/entities/request.entity';
import type { EventsService, EmitEventParams } from '@modules/events/events.service';
import { PipelineGraphEngine } from '../graph.engine';
import { NodeRegistry } from '../node-registry';
import { PipelineInfraError } from '../pipeline.errors';
import type { PipelineNode } from '../types';

function fakeRequest(node: CurrentNode = CurrentNode.PARSE): Request {
  return {
    id: 'req-1',
    org_id: 'org-1',
    current_node: node,
    status: RequestStatus.PARSING,
    routing: null,
    processing_started_at: null,
  } as Request;
}

function makeRequests(record: Request) {
  return {
    get: vi.fn().mockResolvedValue(record),
    setCurrentNode: vi.fn().mockImplementation((_id: string, node: CurrentNode) => {
      record.current_node = node;
    }),
    setStatus: vi.fn().mockImplementation((_id: string, status: RequestStatus) => {
      record.status = status;
    }),
    markProcessing: vi.fn().mockResolvedValue(undefined),
  };
}

function makeEvents() {
  const calls: EmitEventParams[] = [];
  return {
    emit: vi.fn().mockImplementation((params: EmitEventParams) => {
      calls.push(params);
      return Promise.resolve();
    }),
    calls,
  };
}

function makeEngine(node: PipelineNode, record: Request, events: ReturnType<typeof makeEvents>) {
  const registry = new NodeRegistry();
  registry.register(node);
  return new PipelineGraphEngine(
    registry,
    makeRequests(record) as unknown as ConstructorParameters<typeof PipelineGraphEngine>[1],
    events as unknown as EventsService,
  );
}

describe('stage.error contract (EC-04)', () => {
  it('non-infra node throw: stage.error emits before processing.complete with NEEDS_REVIEW', async () => {
    const record = fakeRequest();
    const events = makeEvents();

    const engine = makeEngine(
      {
        name: CurrentNode.PARSE,
        run: async () => {
          throw new Error('parse exploded');
        },
      },
      record,
      events,
    );

    await engine.run('req-1');

    const names = events.calls.map((c) => c.eventName);
    const stageIdx = names.indexOf('stage.error');
    const completeIdx = names.indexOf('processing.complete');

    expect(stageIdx).toBeGreaterThanOrEqual(0);
    expect(completeIdx).toBeGreaterThanOrEqual(0);
    expect(stageIdx).toBeLessThan(completeIdx);

    expect(events.calls[stageIdx].attributes).toMatchObject({
      stage: CurrentNode.PARSE,
      reason: 'unknown',
      escalated_to_human: true,
    });
    expect(record.status).toBe(RequestStatus.NEEDS_REVIEW);
  });

  it('clarify result from a node: engine does NOT emit stage.error', async () => {
    const record = fakeRequest();
    const events = makeEvents();

    const engine = makeEngine(
      {
        name: CurrentNode.PARSE,
        run: async () => ({ kind: 'clarify' as const }),
      },
      record,
      events,
    );

    await engine.run('req-1');

    expect(events.calls.filter((c) => c.eventName === 'stage.error')).toHaveLength(0);
  });

  it('infra error throw: stage.error emits and request finalizes as FAILED (not NEEDS_REVIEW)', async () => {
    const record = fakeRequest();
    const events = makeEvents();

    const engine = makeEngine(
      {
        name: CurrentNode.PARSE,
        run: async () => {
          throw new PipelineInfraError('DB connection lost');
        },
      },
      record,
      events,
    );

    await engine.run('req-1');

    expect(events.calls.filter((c) => c.eventName === 'stage.error').length).toBeGreaterThanOrEqual(
      1,
    );
    expect(record.status).toBe(RequestStatus.FAILED);
  });
});
