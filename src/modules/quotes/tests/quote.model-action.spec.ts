import { QuoteModelAction } from '../quote.model-action';
import { QuoteStatus } from '../enums/quote-status.enum';
import { Quote } from '../entities/quote.entity';
import { QuoteLineItem } from '../entities/quote-line-item.entity';

function setup() {
  const repository = {
    update: vi.fn().mockResolvedValue({ affected: 1 }),
  };
  const manager = {
    findOne: vi.fn(),
    find: vi.fn().mockResolvedValue([]),
  };
  const dataSource = {
    transaction: vi.fn(async (work: (em: unknown) => Promise<unknown>) => work(manager)),
  };
  const action = new QuoteModelAction(repository as never, dataSource as never);
  return { action, repository, manager, dataSource };
}

describe('QuoteModelAction.tryClaimForApproval', () => {
  it('claims a draft quote and returns true', async () => {
    const { action, repository } = setup();

    const result = await action.tryClaimForApproval('quote-1', 'user-1');

    expect(repository.update).toHaveBeenCalledWith(
      { id: 'quote-1', status: QuoteStatus.DRAFT },
      { status: QuoteStatus.APPROVED, approved_by: 'user-1' },
    );
    expect(result).toBe(true);
  });

  it('accepts a null approver', async () => {
    const { action, repository } = setup();

    await action.tryClaimForApproval('quote-1', null);

    expect(repository.update).toHaveBeenCalledWith(
      { id: 'quote-1', status: QuoteStatus.DRAFT },
      { status: QuoteStatus.APPROVED, approved_by: null },
    );
  });

  it('returns false when the quote is not in draft', async () => {
    const { action, repository } = setup();
    repository.update.mockResolvedValue({ affected: 0 });

    const result = await action.tryClaimForApproval('quote-1', 'user-1');

    expect(result).toBe(false);
  });
});

describe('QuoteModelAction.markReady', () => {
  it('sets status, pdf_storage_url, and pdf_generated_at', async () => {
    const { action, repository } = setup();

    await action.markReady('quote-1', 'quotes/org-1/quote-1.pdf');

    expect(repository.update).toHaveBeenCalledWith(
      { id: 'quote-1' },
      expect.objectContaining({
        status: QuoteStatus.READY,
        pdf_storage_url: 'quotes/org-1/quote-1.pdf',
        pdf_generated_at: expect.any(Date),
      }),
    );
  });
});

describe('QuoteModelAction.revertToDraft', () => {
  it('reverts an approved quote back to draft, clearing approved_by', async () => {
    const { action, repository } = setup();

    await action.revertToDraft('quote-1');

    expect(repository.update).toHaveBeenCalledWith(
      { id: 'quote-1', status: QuoteStatus.APPROVED },
      { status: QuoteStatus.DRAFT, approved_by: null },
    );
  });
});

describe('QuoteModelAction.getByIdWithLines', () => {
  it('returns null when the quote does not exist', async () => {
    const { action, manager } = setup();
    manager.findOne.mockResolvedValue(null);

    const result = await action.getByIdWithLines('quote-1');

    expect(result).toBeNull();
  });

  it('returns the quote and its lines ordered by position', async () => {
    const { action, manager } = setup();
    const quote = { id: 'quote-1' } as Quote;
    const lines = [{ id: 'line-1', position: 1 } as QuoteLineItem];
    manager.findOne.mockResolvedValue(quote);
    manager.find.mockResolvedValue(lines);

    const result = await action.getByIdWithLines('quote-1');

    expect(manager.findOne).toHaveBeenCalledWith(Quote, { where: { id: 'quote-1' } });
    expect(manager.find).toHaveBeenCalledWith(QuoteLineItem, {
      where: { quote_id: 'quote-1' },
      order: { position: 'ASC' },
    });
    expect(result).toEqual({ quote, lines });
  });
});
