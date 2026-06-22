import { LlmClientService } from '../llm-client.service';
import { CircuitBreakerService } from '../circuit-breaker.service';
import { CircuitBreakerOpenError } from '../pipeline.errors';
import { BackoffService } from '@worker/backoff.service';
import type { EventsService } from '@modules/events/events.service';
import OpenAI from 'openai';

// Mock env
vi.mock('@config/env', () => ({
  env: {
    LLM_API_KEY: 'test-key',
    LLM_BASE_URL: 'http://localhost:11434/v1',
    LLM_MODEL: 'qwen-72b',
    LLM_TIMEOUT_MS: 5000,
    LLM_MAX_RETRIES: 1,
    DEMO_MODE: false,
    CIRCUIT_BREAKER_WINDOW_S: 60,
    CIRCUIT_BREAKER_COOLDOWN_S: 30,
  },
}));

// Shared context for tests
const baseContext = { orgId: 'org-1', requestId: 'req-1', node: 'extract' };
const baseParams: OpenAI.Chat.ChatCompletionCreateParams = {
  model: 'qwen-72b',
  messages: [{ role: 'user', content: 'test' }],
};

describe('LlmClientService', () => {
  let service: LlmClientService;
  let circuitBreaker: CircuitBreakerService;
  let backoff: BackoffService;
  let eventsService: { emit: ReturnType<typeof vi.fn> };
  let createSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    circuitBreaker = new CircuitBreakerService();
    backoff = new BackoffService();
    vi.spyOn(backoff, 'calculateWaitMs').mockReturnValue(0);

    eventsService = { emit: vi.fn().mockResolvedValue(undefined) };

    service = new LlmClientService(
      circuitBreaker,
      backoff,
      eventsService as unknown as EventsService,
    );

    // Spy on the underlying OpenAI call
    createSpy = vi.fn();
    (service as unknown as { openai: OpenAI }).openai = {
      chat: { completions: { create: createSpy } },
    } as unknown as OpenAI;
  });

  describe('AC-01: retry once on transient error, then route to needs_review', () => {
    it('retries once on a 500 error, then throws', async () => {
      const serverError = new OpenAI.APIError(
        500,
        undefined,
        'Internal Server Error',
        undefined as unknown as Headers,
      );
      createSpy.mockRejectedValue(serverError);

      await expect(service.createChatCompletion(baseParams, baseContext)).rejects.toThrow();

      // First call + 1 retry = 2 total calls
      expect(createSpy).toHaveBeenCalledTimes(2);
    });

    it('succeeds on the retry without circuit breaker tripping', async () => {
      const serverError = new OpenAI.APIError(
        500,
        undefined,
        'Internal Server Error',
        undefined as unknown as Headers,
      );
      const successResponse = { id: 'chatcmpl-1', object: 'chat.completion', choices: [] };

      createSpy.mockRejectedValueOnce(serverError).mockResolvedValueOnce(successResponse);

      const result = await service.createChatCompletion(baseParams, baseContext);
      expect(result).toEqual(successResponse);
      expect(createSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('AC-07: no retry on 4xx', () => {
    it('does not retry a 400 Bad Request', async () => {
      const badRequest = new OpenAI.APIError(
        400,
        undefined,
        'Bad Request',
        undefined as unknown as Headers,
      );
      createSpy.mockRejectedValue(badRequest);

      await expect(service.createChatCompletion(baseParams, baseContext)).rejects.toThrow();

      expect(createSpy).toHaveBeenCalledTimes(1);
    });

    it('does not retry a 401 Auth error', async () => {
      const authError = new OpenAI.APIError(
        401,
        undefined,
        'Unauthorized',
        undefined as unknown as Headers,
      );
      createSpy.mockRejectedValue(authError);

      await expect(service.createChatCompletion(baseParams, baseContext)).rejects.toThrow();

      expect(createSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('EC-05: 429 is treated as transient', () => {
    it('retries once on a 429 rate limit error', async () => {
      const rateLimitError = new OpenAI.APIError(
        429,
        undefined,
        'Rate limited',
        undefined as unknown as Headers,
      );
      createSpy.mockRejectedValue(rateLimitError);

      await expect(service.createChatCompletion(baseParams, baseContext)).rejects.toThrow();

      expect(createSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('AC-04: open breaker skips the LLM call', () => {
    it('throws CircuitBreakerOpenError immediately when breaker is open', async () => {
      // Trip the breaker
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      await expect(service.createChatCompletion(baseParams, baseContext)).rejects.toBeInstanceOf(
        CircuitBreakerOpenError,
      );

      // No LLM call attempted
      expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('emits stage.error with reason llm_circuit_open when breaker is open', async () => {
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      await expect(service.createChatCompletion(baseParams, baseContext)).rejects.toThrow();

      expect(eventsService.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'stage.error',
          attributes: expect.objectContaining({
            reason: 'llm_circuit_open',
            escalated_to_human: true,
          }),
        }),
      );
    });
  });

  describe('AC-06: stage.error SSE payload', () => {
    it('does NOT include raw error body (SEC-02)', async () => {
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      await expect(service.createChatCompletion(baseParams, baseContext)).rejects.toThrow();

      const emitCall = eventsService.emit.mock.calls[0][0];
      expect(emitCall.attributes).not.toHaveProperty('error');
      expect(emitCall.attributes).toHaveProperty('reason');
      expect(emitCall.attributes).toHaveProperty('node');
      expect(emitCall.attributes).toHaveProperty('escalated_to_human');
    });
  });
});
