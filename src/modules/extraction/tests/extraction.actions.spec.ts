import { ExtractionActions } from '../actions/extraction.actions';
import { ExtractionStatus } from '../../requests/enums/extraction-status.enum';
import type { Extraction } from '../entities/extraction.entity';
import type { Repository } from 'typeorm';

describe('ExtractionActions', () => {
  let actions: ExtractionActions;
  let mockRepo: Partial<Repository<Extraction>>;

  const mockExtraction = {
    id: 'ext-1',
    request_id: 'req-1',
    model: 'llama-3.3-70b-versatile',
    schema_valid: true,
    status: ExtractionStatus.COMPLETED,
    raw_json: { items: [] },
    reextract_count: 0,
    loop_steps: [],
    latency_ms: 100,
    created_at: new Date('2026-06-22T12:00:00Z'),
  } as unknown as Extraction;

  beforeEach(() => {
    mockRepo = {
      findOne: vi.fn(),
    };
    actions = new ExtractionActions(mockRepo as Repository<Extraction>);
  });

  describe('findValidExtraction', () => {
    it('returns the extraction when a valid completed row exists (AC: Extract node short-circuits)', async () => {
      mockRepo.findOne = vi.fn().mockResolvedValue(mockExtraction);

      const result = await actions.findValidExtraction('req-1');

      expect(result).toEqual(mockExtraction);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: {
          request_id: 'req-1',
          status: ExtractionStatus.COMPLETED,
          schema_valid: true,
        },
        order: { created_at: 'DESC' },
      });
    });

    it('returns null when no valid extraction exists', async () => {
      mockRepo.findOne = vi.fn().mockResolvedValue(null);

      const result = await actions.findValidExtraction('req-1');

      expect(result).toBeNull();
    });

    it('filters by completion status and schema validity', async () => {
      mockRepo.findOne = vi.fn().mockResolvedValue(null);

      await actions.findValidExtraction('req-1');

      expect(mockRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: ExtractionStatus.COMPLETED,
            schema_valid: true,
          }),
        }),
      );
    });

    it('orders by created_at desc so the latest valid extraction wins', async () => {
      mockRepo.findOne = vi.fn().mockResolvedValue(mockExtraction);

      await actions.findValidExtraction('req-1');

      expect(mockRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { created_at: 'DESC' },
        }),
      );
    });
  });

  describe('hasValidExtraction', () => {
    it('returns true when a valid extraction exists (EC: Idempotent check prevents duplicate)', async () => {
      mockRepo.findOne = vi.fn().mockResolvedValue(mockExtraction);

      const result = await actions.hasValidExtraction('req-1');

      expect(result).toBe(true);
    });

    it('returns false when no valid extraction exists', async () => {
      mockRepo.findOne = vi.fn().mockResolvedValue(null);

      const result = await actions.hasValidExtraction('req-1');

      expect(result).toBe(false);
    });
  });
});
