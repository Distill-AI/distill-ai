import { ExtractionStatus } from '../../requests/enums/extraction-status.enum';
import { ExtractionActions } from '../actions/extraction.actions';
import type { Extraction } from '../entities/extraction.entity';
import type { Repository } from 'typeorm';

describe('reconciliation', () => {
  let actions: ExtractionActions;
  let mockRepo: Partial<Repository<Extraction>>;

  const validExtraction = {
    id: 'ext-1',
    request_id: 'req-1',
    model: 'gpt-4o-mini',
    schema_valid: true,
    status: ExtractionStatus.COMPLETED,
    raw_json: { items: [{ sku: 'A1', qty: 10 }] },
    reextract_count: 0,
    loop_steps: [],
    latency_ms: 200,
    created_at: new Date('2026-06-22T12:00:00Z'),
  } as Extraction;

  beforeEach(() => {
    mockRepo = {
      findOne: vi.fn(),
    };
    actions = new ExtractionActions(mockRepo as Repository<Extraction>);
  });

  it('finds the latest valid extraction when one exists', async () => {
    mockRepo.findOne = vi.fn().mockResolvedValue(validExtraction);

    const result = await actions.findValidExtraction('req-1');

    expect(result).toEqual(validExtraction);
    expect(result?.schema_valid).toBe(true);
    expect(result?.status).toBe(ExtractionStatus.COMPLETED);
  });

  it('returns null when only failed/incomplete extractions exist', async () => {
    mockRepo.findOne = vi.fn().mockResolvedValue(null);

    const result = await actions.findValidExtraction('req-1');

    expect(result).toBeNull();
  });

  it('ignores extractions with schema_valid=false', async () => {
    mockRepo.findOne = vi.fn().mockResolvedValue(null);

    await actions.findValidExtraction('req-1');

    expect(mockRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          schema_valid: true,
        }),
      }),
    );
  });

  it('ignores extractions with status other than COMPLETED', async () => {
    mockRepo.findOne = vi.fn().mockResolvedValue(null);

    await actions.findValidExtraction('req-1');

    expect(mockRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: ExtractionStatus.COMPLETED,
        }),
      }),
    );
  });

  it('ensureNoDuplication returns true when valid extraction exists (idempotent)', async () => {
    mockRepo.findOne = vi.fn().mockResolvedValue(validExtraction);

    const result = await actions.ensureNoDuplication('req-1');

    expect(result).toBe(true);
  });

  it('ensureNoDuplication returns false when no valid extraction', async () => {
    mockRepo.findOne = vi.fn().mockResolvedValue(null);

    const result = await actions.ensureNoDuplication('req-1');

    expect(result).toBe(false);
  });
});
