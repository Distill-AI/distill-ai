import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import type { AttachmentModelAction } from '../attachments.model-action';
import type { Attachment } from '../entities/attachment.entity';
import type { ObjectStore } from '@common/object-store/object-store.port';
import { AttachmentsService } from '../services/attachments.service';

function setup(attachment: Attachment | null) {
  const attachments = { get: vi.fn().mockResolvedValue(attachment) };
  const store = { get: vi.fn().mockResolvedValue(Buffer.from('BYTES')), put: vi.fn() };
  const service = new AttachmentsService(
    attachments as unknown as AttachmentModelAction,
    store as unknown as ObjectStore,
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
