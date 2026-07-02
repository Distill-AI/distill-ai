import { vi } from 'vitest';

// DEMO_MODE on so classify takes the keys-removed fixture path (NFR-OPS-4).
vi.mock('@config/env', () => ({
  env: { DEMO_MODE: true, CLASSIFY_THRESHOLD: 0.8, LLM_MODEL: 'demo' },
}));

import { ClassifyService } from '../services/classify.service';
import type { LLMProvider } from '@modules/llm/llm.provider';

function makeService() {
  const llm = {
    invoke: vi.fn().mockRejectedValue(new Error('LLM must not be called in DEMO_MODE')),
  };
  return { service: new ClassifyService(llm as unknown as LLMProvider), llm };
}

describe('ClassifyService (DEMO_MODE fixture fallback)', () => {
  it('classifies from the matching fixture without calling the LLM', async () => {
    const { service, llm } = makeService();

    const result = await service.classify({
      company: 'Delta Ridge Manufacturing',
      contact: 'Marcus Webb',
      description: 'Restock fastener inventory',
      lineItems: [{ raw_text: 'M8 Hex Bolt, Zinc Plated, Grade 8.8', position: 1 }],
    });

    expect(llm.invoke).not.toHaveBeenCalled();
    expect(result.type).toBe('catalog_rfq');
    // Above CLASSIFY_THRESHOLD, so it is not treated as low-confidence and defaulted.
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('still short-circuits malformed (empty) input to service_quote without the LLM', async () => {
    const { service, llm } = makeService();

    const result = await service.classify({ company: '', contact: '', description: '   ' });

    expect(llm.invoke).not.toHaveBeenCalled();
    expect(result.type).toBe('service_quote');
    expect(result.confidence).toBe(0);
  });
});
