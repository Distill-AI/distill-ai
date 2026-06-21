import { describe, it, expect, vi, beforeEach } from 'vitest';
import { env } from '@config/env';
import { ClassifyService } from '../services/classify.service';
import type { LLMProvider, LLMInvokeResponse } from '@modules/llm/llm.provider';

function makeLLM(): LLMProvider {
  return {
    invoke: vi.fn(),
  } as unknown as LLMProvider;
}

describe('ClassifyService', () => {
  let llm: LLMProvider;
  let service: ClassifyService;

  beforeEach(() => {
    llm = makeLLM();
    service = new ClassifyService(llm);
  });

  describe('catalog_rfq classification', () => {
    it('classifies discrete parts request as catalog_rfq', async () => {
      const mockResponse: LLMInvokeResponse = {
        text: '{"type": "catalog_rfq", "confidence": 0.95}',
      };
      vi.mocked(llm.invoke).mockResolvedValue(mockResponse);

      const result = await service.classify({
        company: 'Acme Corp',
        contact: 'John',
        description: 'Need 100x M5 bolts, 50x widget-A, 20x rubber gasket',
      });

      expect(result.type).toBe('catalog_rfq');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('classifies with specific part numbers as catalog_rfq', async () => {
      const mockResponse: LLMInvokeResponse = {
        text: '{"type": "catalog_rfq", "confidence": 0.92}',
      };
      vi.mocked(llm.invoke).mockResolvedValue(mockResponse);

      const result = await service.classify({
        company: 'PartsCo',
        contact: 'Jane',
        description: 'RFQ for SKU-1234, SKU-5678, qty 50 each',
      });

      expect(result.type).toBe('catalog_rfq');
      expect(result.confidence).toBe(0.92);
    });
  });

  describe('service_quote classification', () => {
    it('classifies scoped job as service_quote', async () => {
      const mockResponse: LLMInvokeResponse = {
        text: '{"type": "service_quote", "confidence": 0.88}',
      };
      vi.mocked(llm.invoke).mockResolvedValue(mockResponse);

      const result = await service.classify({
        company: 'BizCo',
        contact: 'Bob',
        description: 'Need help implementing CRM system, 3-month engagement',
      });

      expect(result.type).toBe('service_quote');
      expect(result.confidence).toBe(0.88);
    });

    it('classifies consulting request as service_quote', async () => {
      const mockResponse: LLMInvokeResponse = {
        text: '{"type": "service_quote", "confidence": 0.91}',
      };
      vi.mocked(llm.invoke).mockResolvedValue(mockResponse);

      const result = await service.classify({
        company: 'ConsultCo',
        contact: 'Alice',
        description: 'Need consulting for digital transformation project',
      });

      expect(result.type).toBe('service_quote');
    });
  });

  describe('confidence threshold', () => {
    it('defaults to service_quote when confidence below threshold', async () => {
      const mockResponse: LLMInvokeResponse = {
        text: '{"type": "catalog_rfq", "confidence": 0.3}',
      };
      vi.mocked(llm.invoke).mockResolvedValue(mockResponse);

      const result = await service.classify({
        company: 'LowConfCo',
        contact: 'Test',
        description: 'Some ambiguous parts request',
      });

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
    it('retries once on LLM failure, then defaults to service_quote', async () => {
      vi.mocked(llm.invoke)
        .mockRejectedValueOnce(new Error('LLM timeout'))
        .mockRejectedValueOnce(new Error('LLM retry also failed'));

      const result = await service.classify({
        company: 'RetryCo',
        contact: 'Retry',
        description: 'Test request',
      });

      expect(result.type).toBe('service_quote');
      expect(result.confidence).toBe(0);
    });

    it('succeeds on retry after first failure', async () => {
      vi.mocked(llm.invoke)
        .mockRejectedValueOnce(new Error('LLM timeout'))
        .mockResolvedValueOnce({ text: '{"type": "service_quote", "confidence": 0.85}' });

      const result = await service.classify({
        company: 'RetryCo',
        contact: 'Retry',
        description: 'Test request',
      });

      expect(result.type).toBe('service_quote');
      expect(result.confidence).toBe(0.85);
    });

    it('defaults to service_quote with malformed input', async () => {
      const result = await service.classify({
        company: '',
        contact: '',
        description: '',
        lineItems: [],
      });

      expect(result.type).toBe('service_quote');
      expect(result.confidence).toBe(0);
      expect(llm.invoke).not.toHaveBeenCalled();
    });
  });

  describe('non-english request', () => {
    it('still classifies non-english request', async () => {
      const mockResponse: LLMInvokeResponse = {
        text: '{"type": "catalog_rfq", "confidence": 0.9}',
      };
      vi.mocked(llm.invoke).mockResolvedValue(mockResponse);

      const result = await service.classify({
        company: 'Empresa XYZ',
        contact: 'Carlos',
        description: 'Necesito 100 tornillos M5 y 50 arandelas',
      });

      expect(result.type).toBe('catalog_rfq');
      expect(result.confidence).toBe(0.9);
    });
  });
});
