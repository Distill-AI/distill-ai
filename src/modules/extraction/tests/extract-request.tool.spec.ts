import { vi } from 'vitest';

vi.mock('@config/env', () => ({
  env: { DEMO_MODE: false, LLM_MODEL: 'qwen-72b' },
}));

import { ExtractRequestToolFactory } from '../tools/extract-request.tool';
import { CircuitBreakerOpenError } from '@modules/pipeline/pipeline.errors';
import type { LlmClientService } from '@modules/llm/llm-client.service';

const VALID_EXTRACTION = {
  company: 'Delta Ridge Manufacturing',
  contact: 'Jane Doe',
  sender_address: null,
  sender_email: 'jane@deltaridge.example',
  delivery_date: null,
  line_items: [{ position: 1, raw_text: 'M8 Hex Bolt', quantity: 500, unit: 'ea' }],
};

function makeCompletion(content: string) {
  return { choices: [{ message: { content } }] };
}

function makeTool(createChatCompletion: ReturnType<typeof vi.fn>) {
  const llm = { createChatCompletion };
  const factory = new ExtractRequestToolFactory(llm as unknown as LlmClientService);
  return { contract: factory.create(), llm };
}

describe('ExtractRequestToolFactory (LlmClientService migration)', () => {
  it('calls createChatCompletion with the threaded context and node "extract"', async () => {
    const createChatCompletion = vi
      .fn()
      .mockResolvedValue(makeCompletion(JSON.stringify(VALID_EXTRACTION)));
    const { contract } = makeTool(createChatCompletion);

    await contract.execute(
      { text: 'RFQ text', priorFailure: null },
      { orgId: 'org-1', requestId: 'req-1' },
    );

    expect(createChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'qwen-72b', temperature: 0.2, max_tokens: 1500 }),
      { orgId: 'org-1', requestId: 'req-1', node: 'extract', requestType: 'catalog_rfq' },
    );
  });

  it('defaults orgId/requestId to empty strings when no context is passed', async () => {
    const createChatCompletion = vi
      .fn()
      .mockResolvedValue(makeCompletion(JSON.stringify(VALID_EXTRACTION)));
    const { contract } = makeTool(createChatCompletion);

    await contract.execute({ text: 'RFQ text', priorFailure: null });

    expect(createChatCompletion).toHaveBeenCalledWith(expect.anything(), {
      orgId: '',
      requestId: '',
      node: 'extract',
      requestType: 'catalog_rfq',
    });
  });

  it('parses the completion content into the extraction shape', async () => {
    const createChatCompletion = vi
      .fn()
      .mockResolvedValue(makeCompletion(JSON.stringify(VALID_EXTRACTION)));
    const { contract } = makeTool(createChatCompletion);

    const result = await contract.execute({ text: 'RFQ text', priorFailure: null });

    expect(result.company).toBe('Delta Ridge Manufacturing');
    expect(result.line_items).toHaveLength(1);
  });

  it('propagates CircuitBreakerOpenError uncaught', async () => {
    const createChatCompletion = vi.fn().mockRejectedValue(new CircuitBreakerOpenError());
    const { contract } = makeTool(createChatCompletion);

    await expect(contract.execute({ text: 'RFQ text', priorFailure: null })).rejects.toBeInstanceOf(
      CircuitBreakerOpenError,
    );
  });
});
