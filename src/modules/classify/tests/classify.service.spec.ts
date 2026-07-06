import { env } from '@config/env';
import { ClassifyService } from '../services/classify.service';
import { CircuitBreakerOpenError } from '@modules/pipeline/pipeline.errors';
import type { LlmClientService } from '@modules/llm/llm-client.service';

const CONTEXT = { orgId: 'org-1', requestId: 'req-1' };

function makeCompletion(content: string) {
  return { choices: [{ message: { content } }] };
}

function makeLLM(): LlmClientService {
  return {
    createChatCompletion: vi.fn(),
  } as unknown as LlmClientService;
}

describe('ClassifyService', () => {
  let llm: LlmClientService;
  let service: ClassifyService;

  beforeEach(() => {
    llm = makeLLM();
    service = new ClassifyService(llm);
  });

  describe('catalog_rfq classification', () => {
    it('classifies discrete parts request as catalog_rfq', async () => {
      vi.mocked(llm.createChatCompletion).mockResolvedValue(
        makeCompletion('{"type": "catalog_rfq", "confidence": 0.95}') as never,
      );

      const result = await service.classify(
        {
          company: 'Acme Corp',
          contact: 'John',
          description: 'Need 100x M5 bolts, 50x widget-A, 20x rubber gasket',
        },
        CONTEXT,
      );

      expect(result.type).toBe('catalog_rfq');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('classifies with specific part numbers as catalog_rfq', async () => {
      vi.mocked(llm.createChatCompletion).mockResolvedValue(
        makeCompletion('{"type": "catalog_rfq", "confidence": 0.92}') as never,
      );

      const result = await service.classify(
        {
          company: 'PartsCo',
          contact: 'Jane',
          description: 'RFQ for SKU-1234, SKU-5678, qty 50 each',
        },
        CONTEXT,
      );

      expect(result.type).toBe('catalog_rfq');
      expect(result.confidence).toBe(0.92);
    });
  });

  describe('service_quote classification', () => {
    it('classifies scoped job as service_quote', async () => {
      vi.mocked(llm.createChatCompletion).mockResolvedValue(
        makeCompletion('{"type": "service_quote", "confidence": 0.88}') as never,
      );

      const result = await service.classify(
        {
          company: 'BizCo',
          contact: 'Bob',
          description: 'Need help implementing CRM system, 3-month engagement',
        },
        CONTEXT,
      );

      expect(result.type).toBe('service_quote');
      expect(result.confidence).toBe(0.88);
    });

    it('classifies consulting request as service_quote', async () => {
      vi.mocked(llm.createChatCompletion).mockResolvedValue(
        makeCompletion('{"type": "service_quote", "confidence": 0.91}') as never,
      );

      const result = await service.classify(
        {
          company: 'ConsultCo',
          contact: 'Alice',
          description: 'Need consulting for digital transformation project',
        },
        CONTEXT,
      );

      expect(result.type).toBe('service_quote');
    });
  });

  describe('confidence threshold', () => {
    it('defaults to service_quote when confidence below threshold', async () => {
      vi.mocked(llm.createChatCompletion).mockResolvedValue(
        makeCompletion('{"type": "catalog_rfq", "confidence": 0.3}') as never,
      );

      const result = await service.classify(
        {
          company: 'LowConfCo',
          contact: 'Test',
          description: 'Some ambiguous parts request',
        },
        CONTEXT,
      );

      expect(result.type).toBe('service_quote');
      expect(result.confidence).toBe(0.3);
    });

    it('uses env CLASSIFY_THRESHOLD for threshold comparison', async () => {
      const threshold = env.CLASSIFY_THRESHOLD;
      expect(threshold).toBeGreaterThan(0);
      expect(threshold).toBeLessThanOrEqual(1);
    });
  });

  describe('error handling', () => {
    it('defaults to service_quote when the LLM call fails (no retry at this layer)', async () => {
      vi.mocked(llm.createChatCompletion).mockRejectedValue(new Error('LLM timeout'));

      const result = await service.classify(
        {
          company: 'RetryCo',
          contact: 'Retry',
          description: 'Test request',
        },
        CONTEXT,
      );

      expect(result.type).toBe('service_quote');
      expect(result.confidence).toBe(0);
      expect(llm.createChatCompletion).toHaveBeenCalledOnce();
    });

    it('propagates CircuitBreakerOpenError uncaught instead of defaulting', async () => {
      vi.mocked(llm.createChatCompletion).mockRejectedValue(new CircuitBreakerOpenError());

      await expect(
        service.classify(
          {
            company: 'CircuitCo',
            contact: 'Breaker',
            description: 'Test request',
          },
          CONTEXT,
        ),
      ).rejects.toBeInstanceOf(CircuitBreakerOpenError);
    });

    it('defaults to service_quote with malformed input', async () => {
      const result = await service.classify(
        {
          company: '',
          contact: '',
          description: '',
          lineItems: [],
        },
        CONTEXT,
      );

      expect(result.type).toBe('service_quote');
      expect(result.confidence).toBe(0);
      expect(llm.createChatCompletion).not.toHaveBeenCalled();
    });
  });

  describe('non-english request', () => {
    it('still classifies non-english request', async () => {
      vi.mocked(llm.createChatCompletion).mockResolvedValue(
        makeCompletion('{"type": "catalog_rfq", "confidence": 0.9}') as never,
      );

      const result = await service.classify(
        {
          company: 'Empresa XYZ',
          contact: 'Carlos',
          description: 'Necesito 100 tornillos M5 y 50 arandelas',
        },
        CONTEXT,
      );

      expect(result.type).toBe('catalog_rfq');
      expect(result.confidence).toBe(0.9);
    });
  });
});
