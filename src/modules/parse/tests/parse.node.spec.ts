import { CurrentNode } from '@modules/requests/enums/current-node.enum';
import type { Request } from '@modules/requests/entities/request.entity';
import type { Attachment } from '@modules/requests/entities/attachment.entity';
import type { RequestModelAction } from '@modules/requests/requests.model-action';
import type { AttachmentModelAction } from '@modules/requests/attachments.model-action';
import type { ObjectStore } from '@common/object-store/object-store.port';
import { NodeRegistry } from '@modules/pipeline/node-registry';
import { ParseNode } from '../parse.node';

function makeAttachment(over: Partial<Attachment>): Attachment {
  return {
    id: 'att-1',
    request_id: 'req-1',
    filename: 'items.csv',
    mime_type: 'text/csv',
    size_bytes: 10,
    storage_url: 'attachments/req-1/items.csv',
    parsed_text: null,
    ...over,
  } as Attachment;
}

function setup(attachments: Attachment[], reqExists = true) {
  const requests = {
    get: vi
      .fn()
      .mockResolvedValue(reqExists ? ({ id: 'req-1', org_id: 'org-1' } as Request) : null),
  };
  const attachmentsAction = {
    find: vi
      .fn()
      .mockResolvedValue({ payload: attachments, paginationMeta: { total: attachments.length } }),
    update: vi.fn().mockResolvedValue(null),
  };
  const store = {
    get: vi.fn().mockResolvedValue(Buffer.from('sku,qty\nBOLT,1\n', 'utf8')),
    put: vi.fn(),
  };
  const node = new ParseNode(
    new NodeRegistry(),
    requests as unknown as RequestModelAction,
    attachmentsAction as unknown as AttachmentModelAction,
    store as unknown as ObjectStore,
  );
  return { node, requests, attachmentsAction, store };
}

const ctx = { requestId: 'req-1', orgId: 'org-1' };

describe('ParseNode', () => {
  it('extracts each attachment and writes parsed_text, then advances to extract', async () => {
    const { node, attachmentsAction, store } = setup([
      makeAttachment({ id: 'a1', filename: 'a.csv' }),
      makeAttachment({ id: 'a2', filename: 'b.txt', storage_url: 'attachments/req-1/b.txt' }),
    ]);

    const result = await node.run(ctx);

    expect(result).toEqual({ kind: 'advance', next: CurrentNode.EXTRACT });
    expect(store.get).toHaveBeenCalledTimes(2);
    expect(attachmentsAction.update).toHaveBeenCalledTimes(2);
    const firstUpdate = attachmentsAction.update.mock.calls[0][0];
    expect(firstUpdate.identifierOptions).toEqual({ id: 'a1' });
    expect(firstUpdate.updatePayload.parsed_text).toContain('sku,qty');
  });

  it('advances with no work when the request has no attachments (paste-only)', async () => {
    const { node, store, attachmentsAction } = setup([]);

    const result = await node.run(ctx);

    expect(result).toEqual({ kind: 'advance', next: CurrentNode.EXTRACT });
    expect(store.get).not.toHaveBeenCalled();
    expect(attachmentsAction.update).not.toHaveBeenCalled();
  });

  it('is best-effort: a failing attachment is stored as null and does not sink the request', async () => {
    const { node, attachmentsAction, store } = setup([
      makeAttachment({ id: 'good', filename: 'a.csv' }),
      makeAttachment({
        id: 'bad',
        filename: 'b.csv',
        storage_url: 'attachments/req-1/missing.csv',
      }),
    ]);
    store.get.mockImplementation((url: string) =>
      url.includes('missing')
        ? Promise.reject(new Error('ENOENT'))
        : Promise.resolve(Buffer.from('ok', 'utf8')),
    );

    const result = await node.run(ctx);

    expect(result).toEqual({ kind: 'advance', next: CurrentNode.EXTRACT });
    const badUpdate = attachmentsAction.update.mock.calls.find(
      (c) => c[0].identifierOptions.id === 'bad',
    );
    expect(badUpdate?.[0].updatePayload.parsed_text).toBeNull();
  });

  it('fails when the request does not exist', async () => {
    const { node, store } = setup([], false);

    const result = await node.run(ctx);

    expect(result.kind).toBe('failed');
    expect(store.get).not.toHaveBeenCalled();
  });
});
