import { CurrentNode } from '@modules/requests/enums/current-node.enum';
import { ParseStatus } from '@modules/requests/enums/parse-status.enum';
import { ToolStatus } from '@modules/tools/enums/tools.enums';
import type { RequestModelAction } from '@modules/requests/requests.model-action';
import type { AttachmentModelAction } from '@modules/requests/attachments.model-action';
import type { ToolRegistry } from '@modules/tools/registry';
import type { ExtractionModelAction } from '../extraction.model-action';
import type { LineItemModelAction } from '@modules/catalog/line-item.model-action';
import type { EventsService } from '@modules/events/events.service';
import type { DataSource } from 'typeorm';
import { NodeRegistry } from '@modules/pipeline/node-registry';
import { ExtractNode } from '../extract.node';
import type { Attachment } from '@modules/requests/entities/attachment.entity';
import type { Request } from '@modules/requests/entities/request.entity';

function setup(attachments: Partial<Attachment>[]) {
  const requests = {
    get: vi.fn().mockResolvedValue({
      id: 'req-1',
      org_id: 'org-1',
      source_subject: null,
      source_body: null,
    } as Request),
    update: vi.fn().mockResolvedValue(true),
  };
  const attachmentsAction = {
    find: vi.fn().mockResolvedValue({ payload: attachments }),
  };
  const extractions = {
    findByRequestId: vi.fn().mockResolvedValue(null),
    upsertForRequest: vi.fn().mockResolvedValue(undefined),
  };
  const lineItems = {
    replaceForRequest: vi.fn().mockResolvedValue(undefined),
  };
  const tools = {
    invoke: vi.fn().mockResolvedValue({ status: ToolStatus.ERROR, latency: 1, error: 'fail' }),
  };
  const events = { emit: vi.fn().mockResolvedValue(undefined) };
  const dataSource = {
    transaction: vi.fn().mockImplementation((cb: (m: unknown) => Promise<unknown>) => cb({})),
  };

  const node = new ExtractNode(
    new NodeRegistry(),
    tools as unknown as ToolRegistry,
    requests as unknown as RequestModelAction,
    attachmentsAction as unknown as AttachmentModelAction,
    extractions as unknown as ExtractionModelAction,
    lineItems as unknown as LineItemModelAction,
    events as unknown as EventsService,
    dataSource as unknown as DataSource,
  );

  return { node, tools, attachmentsAction };
}

const ctx = { requestId: 'req-1', orgId: 'org-1' };

describe('ExtractNode.aggregateSourceText', () => {
  it('includes raw_text from MANUAL_PASTE attachments so pasted content reaches extraction', async () => {
    const { node, tools } = setup([
      {
        id: 'att-1',
        request_id: 'req-1',
        parse_status: ParseStatus.MANUAL_PASTE,
        raw_text: 'pasted RFQ content',
        parsed_text: null,
      },
    ]);

    await node.run(ctx);

    expect(tools.invoke).toHaveBeenCalled();
    const [, args] = tools.invoke.mock.calls[0] as [unknown, { text: string }];
    expect(args.text).toContain('pasted RFQ content');
  });

  it('does not include parsed_text from MANUAL_PASTE attachments', async () => {
    const { node, tools } = setup([
      {
        id: 'att-1',
        request_id: 'req-1',
        parse_status: ParseStatus.MANUAL_PASTE,
        raw_text: 'pasted content',
        parsed_text: 'stale extracted text',
      },
    ]);

    await node.run(ctx);

    const [, args] = tools.invoke.mock.calls[0] as [unknown, { text: string }];
    expect(args.text).not.toContain('stale extracted text');
    expect(args.text).toContain('pasted content');
  });

  it('reads parsed_text for non-MANUAL_PASTE attachments', async () => {
    const { node, tools } = setup([
      {
        id: 'att-1',
        request_id: 'req-1',
        parse_status: ParseStatus.PARSED,
        raw_text: null,
        parsed_text: 'extracted PDF text',
      },
    ]);

    await node.run(ctx);

    const [, args] = tools.invoke.mock.calls[0] as [unknown, { text: string }];
    expect(args.text).toContain('extracted PDF text');
  });

  it('advances without invoking the tool when all attachments have no usable text', async () => {
    const { node, tools } = setup([
      {
        id: 'att-1',
        request_id: 'req-1',
        parse_status: ParseStatus.MANUAL_PASTE,
        raw_text: null,
        parsed_text: null,
      },
    ]);

    const result = await node.run(ctx);

    expect(result).toEqual({ kind: 'advance', next: CurrentNode.CLASSIFY });
    expect(tools.invoke).not.toHaveBeenCalled();
  });
});
