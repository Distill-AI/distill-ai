import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import type { RequestModelAction } from '@modules/requests/requests.model-action';
import type { AttachmentModelAction } from '@modules/requests/attachments.model-action';
import type { PipelineRunner } from '@modules/pipeline/pipeline.runner';
import type { ObjectStore } from '@common/object-store/object-store.port';
import { RequestChannel } from '@modules/requests/enums/request-channel.enum';
import { RequestStatus } from '@modules/requests/enums/request-status.enum';
import { CurrentNode } from '@modules/requests/enums/current-node.enum';
import type { EntityManager } from 'typeorm';
import { IngestionService } from '../ingestion.service';
import { DEMO_ORG_ID, MAX_UPLOAD_BYTES, type UploadedFile } from '../ingestion.constants';

function file(name: string, overrides: Partial<UploadedFile> = {}): UploadedFile {
  return {
    originalname: name,
    mimetype: overrides.mimetype ?? 'application/pdf',
    size: overrides.size ?? 10,
    buffer: overrides.buffer ?? Buffer.from('x'),
  };
}

function setup() {
  const requests = {
    create: vi
      .fn()
      .mockImplementation((opts: { createPayload: Record<string, unknown> }) =>
        Promise.resolve({ id: 'req-1', ...opts.createPayload }),
      ),
    markProcessing: vi.fn().mockResolvedValue(undefined),
  };
  const attachments = { create: vi.fn().mockResolvedValue({ id: 'att-1' }) };
  const store = {
    put: vi.fn().mockImplementation((key: string) => Promise.resolve(key)),
    get: vi.fn(),
  };
  const runner = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const em = { query: vi.fn().mockResolvedValue([{ org_id: 'org-xyz' }]) };
  const service = new IngestionService(
    requests as unknown as RequestModelAction,
    attachments as unknown as AttachmentModelAction,
    store as unknown as ObjectStore,
    runner as unknown as PipelineRunner,
  );
  return {
    service,
    requests,
    attachments,
    store,
    runner,
    em: em as unknown as EntityManager,
    emMock: em,
  };
}

describe('IngestionService', () => {
  it('upload: persists a parsing request, stores each file, records attachments, defers enqueue', async () => {
    const { service, requests, attachments, store, runner, em } = setup();
    const files = [file('rfq.pdf'), file('items.csv', { mimetype: 'text/csv' })];
    const afterCommit: Array<() => Promise<void>> = [];

    const result = await service.createRequest({}, files, em, afterCommit);

    const call = requests.create.mock.calls[0][0];
    expect(call.createPayload.channel).toBe(RequestChannel.UPLOAD);
    expect(call.createPayload.status).toBe(RequestStatus.PARSING);
    expect(call.createPayload.current_node).toBe(CurrentNode.PARSE);
    // processing_started_at is owned by the engine's markProcessing(), not stamped at intake.
    expect(call.createPayload.processing_started_at).toBeUndefined();
    expect(call.createPayload.org_id).toBe('org-xyz');
    // Writes enlist in the request-scoped transaction so RLS is satisfied.
    expect(call.transactionOptions).toEqual({ useTransaction: true, transaction: em });
    expect(store.put).toHaveBeenCalledTimes(2);
    expect(attachments.create).toHaveBeenCalledTimes(2);
    // The enqueue is deferred, not fired inside the still-open transaction (issue #93).
    expect(runner.enqueue).not.toHaveBeenCalled();
    expect(afterCommit).toHaveLength(1);
    await afterCommit[0]();
    expect(runner.enqueue).toHaveBeenCalledWith('req-1');
    expect(result.id).toBe('req-1');
  });

  it('paste: records channel=email with source_body and no attachments', async () => {
    const { service, requests, store, runner, em } = setup();
    const afterCommit: Array<() => Promise<void>> = [];

    await service.createRequest({ source_body: 'need 200 M12 bolts' }, [], em, afterCommit);

    const payload = requests.create.mock.calls[0][0].createPayload;
    expect(payload.channel).toBe(RequestChannel.EMAIL);
    expect(payload.source_body).toBe('need 200 M12 bolts');
    expect(store.put).not.toHaveBeenCalled();
    expect(runner.enqueue).not.toHaveBeenCalled();
    expect(afterCommit).toHaveLength(1);
    await afterCommit[0]();
    expect(runner.enqueue).toHaveBeenCalledWith('req-1');
  });

  it('enqueues inline when there is no after-commit registry (non-HTTP caller)', async () => {
    const { service, runner, em } = setup();

    await service.createRequest({ source_body: 'hi' }, [], em);

    expect(runner.enqueue).toHaveBeenCalledWith('req-1');
  });

  it('recovers an already-committed request when the deferred enqueue fails (#93 review)', async () => {
    const { service, requests, runner, em } = setup();
    runner.enqueue.mockRejectedValueOnce(new Error('Bull unavailable'));
    const afterCommit: Array<() => Promise<void>> = [];

    // The request is created and the enqueue is deferred; the failure only surfaces post-commit.
    await service.createRequest({ source_body: 'hi' }, [], em, afterCommit);
    expect(requests.markProcessing).not.toHaveBeenCalled();

    await afterCommit[0]();

    // Enqueue rejected, but the row is not orphaned: markProcessing stamps processing_started_at so
    // the existing RecoverySweep re-enqueues it after the stale window.
    expect(requests.markProcessing).toHaveBeenCalledWith('req-1');
  });

  it('rejects an unsupported file type and persists nothing', async () => {
    const { service, requests, runner, em } = setup();

    await expect(service.createRequest({}, [file('contract.docx')], em)).rejects.toThrow(
      /Unsupported file type/,
    );
    await expect(service.createRequest({}, [file('contract.docx')], em)).rejects.toBeInstanceOf(
      CustomHttpException,
    );
    expect(requests.create).not.toHaveBeenCalled();
    expect(runner.enqueue).not.toHaveBeenCalled();
  });

  it('rejects an allowed extension carrying a disallowed mime type', async () => {
    const { service, requests, em } = setup();
    // .pdf name but an executable mime: the extension passes, the mime check catches it.
    const disguised = file('malware.pdf', { mimetype: 'application/x-msdownload' });

    await expect(service.createRequest({}, [disguised], em)).rejects.toThrow(
      /Unsupported file type/,
    );
    expect(requests.create).not.toHaveBeenCalled();
  });

  it('rejects a mismatched extension/mime PAIR even when both are individually allowed', async () => {
    const { service, requests, em } = setup();
    // .txt is allowed and application/pdf is allowed for .pdf, but not as a pair.
    const mismatched = file('notes.txt', { mimetype: 'application/pdf' });

    await expect(service.createRequest({}, [mismatched], em)).rejects.toThrow(
      /Unsupported file type/,
    );
    expect(requests.create).not.toHaveBeenCalled();
  });

  it('forces channel=upload when files are present even if the client says email', async () => {
    const { service, requests, em } = setup();

    await service.createRequest({ channel: RequestChannel.EMAIL }, [file('rfq.pdf')], em);

    expect(requests.create.mock.calls[0][0].createPayload.channel).toBe(RequestChannel.UPLOAD);
  });

  it('fails fast when an entityManager is present but app.org_id is empty', async () => {
    const { service, requests, em, emMock } = setup();
    emMock.query.mockResolvedValueOnce([{ org_id: '' }]);

    await expect(service.createRequest({ source_body: 'hi' }, [], em)).rejects.toThrow(
      /tenant context is missing/,
    );
    expect(requests.create).not.toHaveBeenCalled();
  });

  it('rejects a file over the size cap', async () => {
    const { service, em } = setup();
    const big = file('big.pdf', { size: MAX_UPLOAD_BYTES + 1 });

    await expect(service.createRequest({}, [big], em)).rejects.toThrow(/File too large/);
  });

  it('rejects a submission with neither files nor pasted text', async () => {
    const { service, em } = setup();

    await expect(service.createRequest({}, [], em)).rejects.toThrow(
      /at least one file or pasted text/,
    );
  });

  it('falls back to the demo org and no transaction when no entityManager is present', async () => {
    const { service, requests } = setup();

    await service.createRequest({ source_body: 'hi' }, [], undefined);

    const call = requests.create.mock.calls[0][0];
    expect(call.createPayload.org_id).toBe(DEMO_ORG_ID);
    expect(call.transactionOptions).toEqual({ useTransaction: false });
  });
});
