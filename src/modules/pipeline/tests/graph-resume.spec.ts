import { CurrentNode } from '@modules/requests/enums/current-node.enum';
import { RequestStatus } from '@modules/requests/enums/request-status.enum';
import { ResumeReason } from '@modules/requests/enums/resume-reason.enum';
import type { Request } from '@modules/requests/entities/request.entity';
import type { RequestModelAction } from '@modules/requests/requests.model-action';
import type { EventsService } from '@modules/events/events.service';
import { PipelineGraphEngine } from '../graph.engine';
import { NodeRegistry } from '../node-registry';
import { RecoverySweep } from '../recovery.sweep';
import type { NodeRecoveryActions } from '@modules/requests/actions/node-recovery.actions';
import type { NodeResult, PipelineNode } from '../types';

// Graph order and the next-node map the fake nodes follow (parse -> ... -> score -> done).
const ORDER: CurrentNode[] = [
  CurrentNode.PARSE,
  CurrentNode.EXTRACT,
  CurrentNode.CLASSIFY,
  CurrentNode.MATCH,
  CurrentNode.PRICE,
  CurrentNode.POLICY,
  CurrentNode.SCORE,
];
const NEXT: Record<CurrentNode, CurrentNode> = {
  [CurrentNode.PARSE]: CurrentNode.EXTRACT,
  [CurrentNode.EXTRACT]: CurrentNode.CLASSIFY,
  [CurrentNode.CLASSIFY]: CurrentNode.MATCH,
  [CurrentNode.MATCH]: CurrentNode.PRICE,
  [CurrentNode.PRICE]: CurrentNode.POLICY,
  [CurrentNode.POLICY]: CurrentNode.SCORE,
  [CurrentNode.SCORE]: CurrentNode.DONE,
  [CurrentNode.DONE]: CurrentNode.DONE,
  [CurrentNode.FAILED]: CurrentNode.FAILED,
};

function makeFakeRequests(startNode: CurrentNode) {
  const record = {
    id: 'req-1',
    org_id: 'org-1',
    current_node: startNode,
    status: RequestStatus.PARSING,
    routing: null,
    processing_started_at: null,
  } as Request;
  return {
    record,
    get: vi.fn().mockImplementation(() => Promise.resolve(record)),
    setCurrentNode: vi.fn().mockImplementation((_id: string, node: CurrentNode) => {
      record.current_node = node;
      return Promise.resolve();
    }),
    setStatus: vi.fn().mockImplementation((_id: string, status: RequestStatus) => {
      record.status = status;
      return Promise.resolve();
    }),
    markProcessing: vi.fn().mockImplementation((_id: string) => {
      record.status = RequestStatus.PARSING;
      record.processing_started_at = new Date(0);
      return Promise.resolve();
    }),
  };
}

function makeEvents() {
  return { emit: vi.fn().mockResolvedValue(undefined) };
}

/** Register a fake node per graph step that records when it ran and the checkpoint it observed. */
function buildRegistry(
  record: Request,
  ran: CurrentNode[],
  seenAtRun: Partial<Record<CurrentNode, CurrentNode>>,
): NodeRegistry {
  const registry = new NodeRegistry();
  for (const name of ORDER) {
    const node: PipelineNode = {
      name,
      run: (): Promise<NodeResult> => {
        ran.push(name);
        seenAtRun[name] = record.current_node;
        return Promise.resolve({ kind: 'advance', next: NEXT[name] });
      },
    };
    registry.register(node);
  }
  return registry;
}

describe('graph-resume', () => {
  it('runs from parse to done, advancing the checkpoint through every node', async () => {
    const requests = makeFakeRequests(CurrentNode.PARSE);
    const events = makeEvents();
    const ran: CurrentNode[] = [];
    const registry = buildRegistry(requests.record, ran, {});
    const engine = new PipelineGraphEngine(
      registry,
      requests as unknown as RequestModelAction,
      events as unknown as EventsService,
    );

    await engine.run('req-1');

    expect(ran).toEqual(ORDER);
    expect(requests.record.current_node).toBe(CurrentNode.DONE);
    // routing is null, so the deterministic terminal status is needs_review.
    expect(requests.record.status).toBe(RequestStatus.NEEDS_REVIEW);
    // processing_started_at must be stamped on run start, or the recovery sweep can never find a
    // crashed run (findStaleParsing keys off this timestamp).
    expect(requests.markProcessing).toHaveBeenCalledWith('req-1');
    expect(requests.record.processing_started_at).not.toBeNull();
  });

  it('resumes at classify after a simulated crash mid-extract (AC: resumes at classify, not extract)', async () => {
    const requests = makeFakeRequests(CurrentNode.CLASSIFY);
    const events = makeEvents();
    const ran: CurrentNode[] = [];
    const registry = buildRegistry(requests.record, ran, {});
    const engine = new PipelineGraphEngine(
      registry,
      requests as unknown as RequestModelAction,
      events as unknown as EventsService,
    );

    await engine.run('req-1');

    expect(ran).not.toContain(CurrentNode.PARSE);
    expect(ran).not.toContain(CurrentNode.EXTRACT);
    expect(ran[0]).toBe(CurrentNode.CLASSIFY);
    expect(requests.record.current_node).toBe(CurrentNode.DONE);
  });

  it('on a logical node error: escalates to needs_review, keeps current_node, emits node.exited', async () => {
    const requests = makeFakeRequests(CurrentNode.CLASSIFY);
    const events = makeEvents();
    const registry = new NodeRegistry();
    registry.register({
      name: CurrentNode.CLASSIFY,
      run: (): Promise<NodeResult> => Promise.reject(new Error('boom')),
    });
    const engine = new PipelineGraphEngine(
      registry,
      requests as unknown as RequestModelAction,
      events as unknown as EventsService,
    );

    await engine.run('req-1');

    // Logical (non-infra) error escalates for human review and leaves the node in place for resume.
    expect(requests.record.status).toBe(RequestStatus.NEEDS_REVIEW);
    expect(requests.record.current_node).toBe(CurrentNode.CLASSIFY);
    expect(requests.setCurrentNode).not.toHaveBeenCalled();
    // SSE must still see a clean close: error, node.exited, then processing.complete with failed status.
    expect(events.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'stage.error',
        attributes: expect.objectContaining({
          node: CurrentNode.CLASSIFY,
          escalated_to_human: true,
        }),
      }),
    );
    expect(events.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'node.exited',
        attributes: expect.objectContaining({
          node: CurrentNode.CLASSIFY,
          status: 'failed',
        }),
      }),
    );
    expect(events.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'processing.complete',
        attributes: expect.objectContaining({ status: 'failed' }),
      }),
    );
  });

  it('writes the current_node checkpoint before the next node runs', async () => {
    const requests = makeFakeRequests(CurrentNode.PARSE);
    const events = makeEvents();
    const ran: CurrentNode[] = [];
    const seenAtRun: Partial<Record<CurrentNode, CurrentNode>> = {};
    const registry = buildRegistry(requests.record, ran, seenAtRun);
    const engine = new PipelineGraphEngine(
      registry,
      requests as unknown as RequestModelAction,
      events as unknown as EventsService,
    );

    await engine.run('req-1');

    // Each node, when it runs, must observe the checkpoint already set to itself: proof the
    // engine persists the next node BEFORE running it (node-level resumability).
    for (const name of ORDER) {
      expect(seenAtRun[name]).toBe(name);
    }
  });

  it('emits request.resumed when resuming from a non-parse node', async () => {
    const requests = makeFakeRequests(CurrentNode.CLASSIFY);
    const events = makeEvents();
    const ran: CurrentNode[] = [];
    const registry = buildRegistry(requests.record, ran, {});
    const engine = new PipelineGraphEngine(
      registry,
      requests as unknown as RequestModelAction,
      events as unknown as EventsService,
    );

    await engine.run('req-1');

    expect(events.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'request.resumed',
        attributes: expect.objectContaining({
          resumed_from_node: CurrentNode.CLASSIFY,
          reason: 'crash_recovery',
        }),
      }),
    );
  });

  it('does not emit request.resumed when starting fresh from parse', async () => {
    const requests = makeFakeRequests(CurrentNode.PARSE);
    const events = makeEvents();
    const ran: CurrentNode[] = [];
    const registry = buildRegistry(requests.record, ran, {});
    const engine = new PipelineGraphEngine(
      registry,
      requests as unknown as RequestModelAction,
      events as unknown as EventsService,
    );

    await engine.run('req-1');

    const resumeCalls = (events.emit as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call: unknown[]) => (call[0] as { eventName: string }).eventName === 'request.resumed',
    );
    expect(resumeCalls).toHaveLength(0);
  });

  describe('RecoverySweep', () => {
    it('re-enqueues every stale parsing request', async () => {
      const staleRequests = [
        { id: 'r1', org_id: 'org-1', current_node: CurrentNode.EXTRACT },
        { id: 'r2', org_id: 'org-2', current_node: CurrentNode.CLASSIFY },
      ];
      const requests = {
        findStaleParsing: vi.fn().mockResolvedValue(staleRequests),
      };
      const nodeRecovery = {
        resumeFromCurrentNode: vi.fn().mockResolvedValue(undefined),
      };
      const sweep = new RecoverySweep(
        requests as unknown as RequestModelAction,
        nodeRecovery as unknown as NodeRecoveryActions,
      );

      await sweep.sweep();

      expect(nodeRecovery.resumeFromCurrentNode).toHaveBeenCalledTimes(2);
      expect(nodeRecovery.resumeFromCurrentNode).toHaveBeenCalledWith(
        'r1',
        ResumeReason.CRASH_RECOVERY,
      );
      expect(nodeRecovery.resumeFromCurrentNode).toHaveBeenCalledWith(
        'r2',
        ResumeReason.CRASH_RECOVERY,
      );
    });

    it('continues recovery when one enqueue fails (per-request isolation)', async () => {
      const staleRequests = [
        { id: 'r1', org_id: 'org-1', current_node: CurrentNode.EXTRACT },
        { id: 'r2', org_id: 'org-2', current_node: CurrentNode.CLASSIFY },
      ];
      const requests = {
        findStaleParsing: vi.fn().mockResolvedValue(staleRequests),
      };
      const nodeRecovery = {
        resumeFromCurrentNode: vi
          .fn()
          .mockRejectedValueOnce(new Error('Bull unavailable'))
          .mockResolvedValueOnce(undefined),
      };
      const sweep = new RecoverySweep(
        requests as unknown as RequestModelAction,
        nodeRecovery as unknown as NodeRecoveryActions,
      );

      await sweep.sweep();

      expect(nodeRecovery.resumeFromCurrentNode).toHaveBeenCalledTimes(2);
      expect(nodeRecovery.resumeFromCurrentNode).toHaveBeenCalledWith(
        'r2',
        ResumeReason.CRASH_RECOVERY,
      );
    });

    it('does nothing when no stale requests exist', async () => {
      const requests = {
        findStaleParsing: vi.fn().mockResolvedValue([]),
      };
      const nodeRecovery = {
        resumeFromCurrentNode: vi.fn(),
      };
      const sweep = new RecoverySweep(
        requests as unknown as RequestModelAction,
        nodeRecovery as unknown as NodeRecoveryActions,
      );

      await sweep.sweep();

      expect(nodeRecovery.resumeFromCurrentNode).not.toHaveBeenCalled();
    });
  });
});
