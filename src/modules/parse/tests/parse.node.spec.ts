import { CurrentNode } from '@modules/requests/enums/current-node.enum';
import { ParseStatus } from '@modules/requests/enums/parse-status.enum';
import { ParseErrorReason } from '@modules/requests/enums/parse-error-reason.enum';
import type { Request } from '@modules/requests/entities/request.entity';
import type { Attachment } from '@modules/requests/entities/attachment.entity';
import type { RequestModelAction } from '@modules/requests/requests.model-action';
import type { AttachmentModelAction } from '@modules/requests/attachments.model-action';
import type { ObjectStore } from '@common/object-store/object-store.port';
import type { EventsService } from '@modules/events/events.service';
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
    parse_status: ParseStatus.UNPARSED,
    parse_error_reason: null,
    raw_text: null,
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
    markUnparsed: vi.fn().mockResolvedValue(undefined),
  };
  const store = {
    get: vi.fn().mockResolvedValue(Buffer.from('sku,qty\nBOLT,1\n', 'utf8')),
    put: vi.fn(),
  };
  const events = { emit: vi.fn().mockResolvedValue(undefined) };
  const node = new ParseNode(
    new NodeRegistry(),
    requests as unknown as RequestModelAction,
    attachmentsAction as unknown as AttachmentModelAction,
    store as unknown as ObjectStore,
    events as unknown as EventsService,
  );
  return { node, requests, attachmentsAction, store, events };
}

const ctx = { requestId: 'req-1', orgId: 'org-1' };

describe('ParseNode', () => {
  it('advances to EXTRACT with no work when the request has no attachments (paste-only)', async () => {
    const { node, store, attachmentsAction } = setup([]);

    const result = await node.run(ctx);

    expect(result).toEqual({ kind: 'advance', next: CurrentNode.EXTRACT });
    expect(store.get).not.toHaveBeenCalled();
    expect(attachmentsAction.update).not.toHaveBeenCalled();
  });

  it('skips object-store fetch for manual_paste attachments and advances to EXTRACT', async () => {
    const { node, store, attachmentsAction } = setup([
      makeAttachment({
        id: 'a1',
        parse_status: ParseStatus.MANUAL_PASTE,
        raw_text: 'pasted content',
      }),
    ]);

    const result = await node.run(ctx);

    expect(result).toEqual({ kind: 'advance', next: CurrentNode.EXTRACT });
    expect(store.get).not.toHaveBeenCalled();
    expect(attachmentsAction.update).not.toHaveBeenCalled();
  });

  it('writes parsed_text and parse_status PARSED when extraction succeeds', async () => {
    const { node, attachmentsAction } = setup([makeAttachment({ id: 'a1', filename: 'a.csv' })]);

    const result = await node.run(ctx);

    expect(result).toEqual({ kind: 'advance', next: CurrentNode.EXTRACT });
    expect(attachmentsAction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        identifierOptions: { id: 'a1' },
        updatePayload: expect.objectContaining({ parse_status: ParseStatus.PARSED }),
      }),
    );
  });

  it('calls markUnparsed, emits stage.error, and returns clarify when extraction fails', async () => {
    const { node, attachmentsAction, store, events } = setup([
      makeAttachment({ id: 'a1', filename: 'a.csv' }),
    ]);
    store.get.mockRejectedValueOnce(new Error('ENOENT'));

    const result = await node.run(ctx);

    expect(result).toEqual({ kind: 'clarify' });
    expect(attachmentsAction.markUnparsed).toHaveBeenCalledWith('a1', ParseErrorReason.UNKNOWN);
    expect(events.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'stage.error',
        attributes: expect.objectContaining({ stage: 'parse', escalated_to_human: true }),
      }),
    );
    expect(attachmentsAction.update).not.toHaveBeenCalled();
  });

  it('fails fast on the first failing attachment and does not process remaining ones', async () => {
    const { node, store, attachmentsAction } = setup([
      makeAttachment({ id: 'bad', filename: 'bad.csv', storage_url: 'bad.csv' }),
      makeAttachment({ id: 'good', filename: 'good.csv', storage_url: 'good.csv' }),
    ]);
    store.get.mockImplementation((url: string) =>
      url === 'bad.csv'
        ? Promise.reject(new Error('ENOENT'))
        : Promise.resolve(Buffer.from('ok', 'utf8')),
    );

    const result = await node.run(ctx);

    expect(result).toEqual({ kind: 'clarify' });
    expect(attachmentsAction.markUnparsed).toHaveBeenCalledTimes(1);
    expect(attachmentsAction.markUnparsed).toHaveBeenCalledWith('bad', ParseErrorReason.UNKNOWN);
    expect(store.get).toHaveBeenCalledTimes(1);
  });

  it('fails when the request does not exist', async () => {
    const { node } = setup([], false);

    const result = await node.run(ctx);

    expect(result.kind).toBe('failed');
  });

  it('surfaces a persistence fault (DB write error is not swallowed as a parse failure)', async () => {
    const { node, attachmentsAction } = setup([makeAttachment({ id: 'a1', filename: 'a.csv' })]);
    attachmentsAction.update.mockRejectedValueOnce(new Error('db down'));

    await expect(node.run(ctx)).rejects.toThrow(/db down/);
  });
});
