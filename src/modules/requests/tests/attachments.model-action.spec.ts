import { ParseErrorReason } from '../enums/parse-error-reason.enum';
import { ParseStatus } from '../enums/parse-status.enum';
import { AttachmentModelAction } from '../attachments.model-action';

function setup() {
  const repository = {
    findOne: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
  };
  const action = new AttachmentModelAction(repository as never);
  return { action, repository };
}

describe('AttachmentModelAction.findByIdForRequest', () => {
  it('returns the attachment when id and request_id both match', async () => {
    const att = { id: 'att-1', request_id: 'req-1' };
    const { action, repository } = setup();
    repository.findOne.mockResolvedValue(att);

    const result = await action.findByIdForRequest('att-1', 'req-1');

    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: 'att-1', request_id: 'req-1' },
    });
    expect(result).toBe(att);
  });

  it('returns null when the attachment belongs to a different request', async () => {
    const { action, repository } = setup();
    repository.findOne.mockResolvedValue(null);

    const result = await action.findByIdForRequest('att-1', 'wrong-req');

    expect(result).toBeNull();
  });
});

describe('AttachmentModelAction.markUnparsed', () => {
  it('sets parse_status to UNPARSED and records the reason', async () => {
    const { action, repository } = setup();

    await action.markUnparsed('att-1', ParseErrorReason.NO_TEXT_LAYER);

    expect(repository.update).toHaveBeenCalledWith(
      { id: 'att-1' },
      { parse_status: ParseStatus.UNPARSED, parse_error_reason: ParseErrorReason.NO_TEXT_LAYER },
    );
  });
});

describe('AttachmentModelAction.markManualPaste', () => {
  it('stores raw_text, sets status to MANUAL_PASTE, and clears parse_error_reason', async () => {
    const { action, repository } = setup();

    await action.markManualPaste('att-1', 'line 1\nline 2');

    expect(repository.update).toHaveBeenCalledWith(
      { id: 'att-1' },
      {
        parse_status: ParseStatus.MANUAL_PASTE,
        raw_text: 'line 1\nline 2',
        parse_error_reason: null,
      },
    );
  });
});
