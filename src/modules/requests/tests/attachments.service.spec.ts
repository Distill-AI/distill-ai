import { HttpStatus } from '@nestjs/common';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import type { AttachmentModelAction } from '../attachments.model-action';
import type { RequestModelAction } from '../requests.model-action';
import type { Attachment } from '../entities/attachment.entity';
import type { Request } from '../entities/request.entity';
import type { ObjectStore } from '@common/object-store/object-store.port';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';
import { RequestStatus } from '../enums/request-status.enum';
import { CurrentNode } from '../enums/current-node.enum';
import { AttachmentsService } from '../services/attachments.service';

function setup(attachment: Attachment | null) {
  const attachments = { get: vi.fn().mockResolvedValue(attachment) };
  const store = { get: vi.fn().mockResolvedValue(Buffer.from('BYTES')), put: vi.fn() };
  const service = new AttachmentsService(
    attachments as unknown as AttachmentModelAction,
    store as unknown as ObjectStore,
    {} as unknown as RequestModelAction,
    { add: vi.fn() } as never,
  );
  return { service, attachments, store };
}

const att = {
  id: 'att-1',
  request_id: 'req-1',
  filename: 'rfq.pdf',
  mime_type: 'application/pdf',
  size_bytes: 5,
  storage_url: 'attachments/req-1/rfq.pdf',
  parsed_text: null,
} as Attachment;

const user: AuthUser = { userId: 'u-1', orgId: 'org-1', roles: ['estimator'], email: 'e@test.com' };

const baseRequest = {
  id: 'req-1',
  org_id: 'org-1',
  status: RequestStatus.NEEDS_REVIEW,
} as Request;

function pasteSetup(request: Request | null, attachment: Attachment | null) {
  const requests = {
    get: vi.fn().mockResolvedValue(request),
    setCurrentNode: vi.fn().mockResolvedValue(undefined),
  };
  const attachments = {
    get: vi.fn(),
    findByIdForRequest: vi.fn().mockResolvedValue(attachment),
    markManualPaste: vi.fn().mockResolvedValue(undefined),
  };
  const store = { get: vi.fn(), put: vi.fn() };
  const queue = { add: vi.fn().mockResolvedValue(undefined) };
  const service = new AttachmentsService(
    attachments as unknown as AttachmentModelAction,
    store as unknown as ObjectStore,
    requests as unknown as RequestModelAction,
    queue as never,
  );
  return { service, requests, attachments, queue };
}

describe('AttachmentsService.getForDownload', () => {
  it('looks up the attachment scoped to its request and returns metadata + bytes', async () => {
    const { service, attachments, store } = setup(att);

    const result = await service.getForDownload('req-1', 'att-1');

    expect(attachments.get).toHaveBeenCalledWith({
      identifierOptions: { id: 'att-1', request_id: 'req-1' },
    });
    expect(store.get).toHaveBeenCalledWith('attachments/req-1/rfq.pdf');
    expect(result.attachment).toBe(att);
    expect(result.bytes.toString()).toBe('BYTES');
  });

  it('throws NotFoundException and never touches the store when the attachment is absent', async () => {
    const { service, store } = setup(null);

    await expect(service.getForDownload('req-1', 'missing')).rejects.toThrow(CustomHttpException);
    expect(store.get).not.toHaveBeenCalled();
  });
});

describe('AttachmentsService.paste', () => {
  const att = { id: 'att-1', request_id: 'req-1' } as Attachment;

  it('throws 409 when the request is already being parsed', async () => {
    const { service } = pasteSetup(
      { ...baseRequest, status: RequestStatus.PARSING } as Request,
      att,
    );

    await expect(service.paste(user, 'req-1', 'att-1', 'content')).rejects.toThrow(
      expect.objectContaining({ status: HttpStatus.CONFLICT }),
    );
  });

  it('throws 404 when the request belongs to a different org (not 403 per SEC-02)', async () => {
    const { service } = pasteSetup({ ...baseRequest, org_id: 'other-org' } as Request, att);

    await expect(service.paste(user, 'req-1', 'att-1', 'content')).rejects.toThrow(
      expect.objectContaining({ status: HttpStatus.NOT_FOUND }),
    );
  });

  it('throws 404 when the attachment does not belong to this request', async () => {
    const { service } = pasteSetup(baseRequest, null);

    await expect(service.paste(user, 'req-1', 'missing-att', 'content')).rejects.toThrow(
      expect.objectContaining({ status: HttpStatus.NOT_FOUND }),
    );
  });

  it('marks paste, re-checkpoints to EXTRACT, and re-enqueues on success', async () => {
    const { service, requests, attachments, queue } = pasteSetup(baseRequest, att);

    await service.paste(user, 'req-1', 'att-1', 'pasted text');

    expect(attachments.markManualPaste).toHaveBeenCalledWith('att-1', 'pasted text');
    expect(requests.setCurrentNode).toHaveBeenCalledWith('req-1', CurrentNode.EXTRACT);
    expect(queue.add).toHaveBeenCalledWith(
      'pipeline:run',
      { requestId: 'req-1' },
      { jobId: 'pipeline:req-1' },
    );
  });
});
