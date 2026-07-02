import { vi } from 'vitest';

// DEMO_MODE on so the tool takes the keys-removed fixture path (NFR-OPS-4). LLM_MODEL is read by
// extractionModelName(); no other env is touched by the tool.
vi.mock('@config/env', () => ({ env: { DEMO_MODE: true, LLM_MODEL: 'demo' } }));

import { ExtractRequestToolFactory } from '../tools/extract-request.tool';
import type { LLMProvider } from '@modules/llm/llm.provider';

const CLEAN_RFQ_BODY = [
  'Please quote on the following:',
  '- 500x M8 Hex Bolt, Zinc Plated, Grade 8.8',
  '- 500x M8 Hex Nut, Zinc Plated',
  '- 200x M8 Flat Washer, Zinc Plated',
].join('\n');

function makeTool() {
  // If the LLM is ever called in DEMO_MODE the test fails loudly — the whole point is no provider call.
  const llm = {
    invoke: vi.fn().mockRejectedValue(new Error('LLM must not be called in DEMO_MODE')),
  };
  const factory = new ExtractRequestToolFactory(llm as unknown as LLMProvider);
  return { contract: factory.create(), llm };
}

describe('ExtractRequestToolFactory (DEMO_MODE fixture fallback)', () => {
  it('extracts from the seed fixture without calling the LLM', async () => {
    const { contract, llm } = makeTool();

    const result = await contract.execute({ text: CLEAN_RFQ_BODY, priorFailure: null });

    expect(llm.invoke).not.toHaveBeenCalled();
    expect(result.company).toBe('Delta Ridge Manufacturing');
    expect(result.line_items.length).toBeGreaterThan(0);
    expect(result.line_items[0].raw_text).toContain('M8 Hex Bolt');
    // Every returned line item must appear in the source so extraction reconciles downstream.
    for (const item of result.line_items.filter((li) => CLEAN_RFQ_BODY.includes(li.raw_text))) {
      expect(CLEAN_RFQ_BODY).toContain(item.raw_text);
    }
  });

  it('falls back to the clean catalog RFQ when no line item matches the text', async () => {
    const { contract, llm } = makeTool();

    const result = await contract.execute({
      text: 'unrelated prose with no catalog items',
      priorFailure: null,
    });

    expect(llm.invoke).not.toHaveBeenCalled();
    expect(result.line_items.length).toBeGreaterThan(0);
  });
});
