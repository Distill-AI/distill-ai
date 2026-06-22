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
  return { service, requests, attachments, store, runner, em: em as unknown as EntityManager };
}

describe('IngestionService', () => {
  it('upload: persists a parsing request, stores each file, records attachments, enqueues', async () => {
    const { service, requests, attachments, store, runner, em } = setup();
    const files = [file('rfq.pdf'), file('items.csv', { mimetype: 'text/csv' })];

    const result = await service.createRequest({}, files, em);

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
    expect(runner.enqueue).toHaveBeenCalledWith('req-1');
    expect(result.id).toBe('req-1');
  });

  it('paste: records channel=email with source_body and no attachments', async () => {
    const { service, requests, store, runner, em } = setup();

    await service.createRequest({ source_body: 'need 200 M12 bolts' }, [], em);

    const payload = requests.create.mock.calls[0][0].createPayload;
    expect(payload.channel).toBe(RequestChannel.EMAIL);
    expect(payload.source_body).toBe('need 200 M12 bolts');
    expect(store.put).not.toHaveBeenCalled();
    expect(runner.enqueue).toHaveBeenCalledWith('req-1');
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
