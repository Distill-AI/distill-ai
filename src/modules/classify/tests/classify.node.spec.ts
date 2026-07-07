import * as SYS_MSG from '@constants/system-messages';
import { CurrentNode } from '@modules/requests/enums/current-node.enum';
import { ToolStatus } from '@modules/tools/enums/tools.enums';
import type { RequestModelAction } from '@modules/requests/requests.model-action';
import type { ToolRegistry } from '@modules/tools/registry';
import type { EventsService } from '@modules/events/events.service';
import type { EntityManager } from 'typeorm';
import { NodeRegistry } from '@modules/pipeline/node-registry';
import { ClassifyNode } from '../classify.node';
import type { Request } from '@modules/requests/entities/request.entity';

function setup(invocation: { status: ToolStatus; result?: unknown; error?: string }) {
  const requests = {
    get: vi.fn().mockResolvedValue({
      id: 'req-1',
      org_id: 'org-1',
      sender_company: 'Acme',
      sender_contact: 'Jane',
      source_subject: 'RFQ',
      source_body: null,
    } as Request),
    update: vi.fn().mockResolvedValue(true),
  };
  const tools = {
    invoke: vi.fn().mockResolvedValue({ latency: 1, ...invocation }),
  };
  const events = { emit: vi.fn().mockResolvedValue(undefined) };
  const em = { find: vi.fn().mockResolvedValue([]) };

  const node = new ClassifyNode(
    new NodeRegistry(),
    tools as unknown as ToolRegistry,
    requests as unknown as RequestModelAction,
    events as unknown as EventsService,
    em as unknown as EntityManager,
  );

  return { node, requests, events };
}

const ctx = { requestId: 'req-1', orgId: 'org-1' };

describe('ClassifyNode.run', () => {
  it('defaults to service_quote at zero confidence on a generic tool failure', async () => {
    const { node, requests } = setup({ status: ToolStatus.ERROR, error: 'transient failure' });

    const result = await node.run(ctx);

    expect(result).toEqual({ kind: 'advance', next: CurrentNode.MATCH });
    expect(requests.update).toHaveBeenCalledWith(
      expect.objectContaining({
        updatePayload: expect.objectContaining({
          request_type: 'service_quote',
          classification_confidence: 0,
        }),
      }),
    );
  });

  it('fails loud instead of defaulting when the DEMO_MODE fixture corpus is unavailable (EC-01)', async () => {
    const { node, requests } = setup({
      status: ToolStatus.ERROR,
      error: SYS_MSG.CLASSIFY_DEMO_FIXTURE_UNAVAILABLE,
    });

    const result = await node.run(ctx);

    expect(result).toEqual({
      kind: 'failed',
      error: { message: SYS_MSG.CLASSIFY_DEMO_FIXTURE_UNAVAILABLE },
    });
    expect(requests.update).not.toHaveBeenCalled();
  });
});
