import { ClassifyRequestToolFactory } from '../tools/classify-request.tool';
import type { ClassifyService } from '../services/classify.service';

function setup() {
  const classifyService = { classify: vi.fn() };
  const factory = new ClassifyRequestToolFactory(classifyService as unknown as ClassifyService);
  return { contract: factory.create(), classifyService };
}

const INPUT = {
  company: 'Acme Corp',
  contact: 'Jane Doe',
  description: 'Need 100x M5 bolts',
  lineItems: [{ raw_text: 'M5 bolt', position: 1, quantity: 100, unit: 'ea' }],
};

describe('ClassifyRequestToolFactory', () => {
  it('maps input fields and threads context into ClassifyService.classify()', async () => {
    const { contract, classifyService } = setup();
    classifyService.classify.mockResolvedValue({ type: 'catalog_rfq', confidence: 0.95 });

    await contract.execute(INPUT, { orgId: 'org-1', requestId: 'req-1' });

    expect(classifyService.classify).toHaveBeenCalledWith(
      {
        company: 'Acme Corp',
        contact: 'Jane Doe',
        description: 'Need 100x M5 bolts',
        lineItems: INPUT.lineItems,
      },
      { orgId: 'org-1', requestId: 'req-1' },
    );
  });

  it('defaults orgId/requestId to empty strings when no context is passed', async () => {
    const { contract, classifyService } = setup();
    classifyService.classify.mockResolvedValue({ type: 'catalog_rfq', confidence: 0.95 });

    await contract.execute(INPUT);

    expect(classifyService.classify).toHaveBeenCalledWith(expect.anything(), {
      orgId: '',
      requestId: '',
    });
  });

  it('returns the result from ClassifyService.classify() unchanged', async () => {
    const { contract, classifyService } = setup();
    classifyService.classify.mockResolvedValue({ type: 'service_quote', confidence: 0.42 });

    const result = await contract.execute(INPUT, { orgId: 'org-1', requestId: 'req-1' });

    expect(result).toEqual({ type: 'service_quote', confidence: 0.42 });
  });

  it('propagates a rejection from ClassifyService.classify() uncaught', async () => {
    const { contract, classifyService } = setup();
    const error = new Error('boom');
    classifyService.classify.mockRejectedValue(error);

    await expect(contract.execute(INPUT, { orgId: 'org-1', requestId: 'req-1' })).rejects.toBe(
      error,
    );
  });
});
