import { Injectable, Logger } from '@nestjs/common';
import { CircuitBreakerService } from './circuit-breaker.service';
import { BackoffService } from '@worker/backoff.service';
import { EventsService } from '@modules/events/events.service';
import { CircuitBreakerOpenError } from './pipeline.errors';
import { env } from '@config/env';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class LlmClientService {
  private readonly logger = new Logger(LlmClientService.name);
  private openai: OpenAI;
  private catalogFixtures: Record<string, unknown>[] | null = null;

  constructor(
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly backoffService: BackoffService,
    private readonly eventsService: EventsService,
  ) {
    this.openai = new OpenAI({
      apiKey: env.LLM_API_KEY || 'dummy-key',
      baseURL: env.LLM_BASE_URL,
      timeout: env.LLM_TIMEOUT_MS,
    });
  }

  private loadFixtures(): Record<string, unknown>[] {
    if (!this.catalogFixtures) {
      try {
        const catalogPath = path.resolve(process.cwd(), 'catalog.json');
        const data = fs.readFileSync(catalogPath, 'utf8');
        this.catalogFixtures = JSON.parse(data);
      } catch (err) {
        this.logger.warn({ event: 'demo_fixture_load_failed', error: (err as Error).message });
        this.catalogFixtures = [];
      }
    }
    return this.catalogFixtures || [];
  }

  private getFixture(requestType: string): Record<string, unknown> | undefined {
    const fixtures = this.loadFixtures();
    return (
      fixtures.find((f) => (f._meta as Record<string, unknown>)?.request_type === requestType) ||
      fixtures.find(
        (f) => (f._meta as Record<string, unknown>)?.sample_id === 'rfq_01_catalog_clean',
      )
    );
  }

  async createChatCompletion(
    params: OpenAI.Chat.ChatCompletionCreateParams,
    context: { orgId: string; requestId: string; node: string; requestType?: string },
  ): Promise<OpenAI.Chat.ChatCompletion> {
    const { orgId, requestId, node, requestType = 'catalog_rfq' } = context;

    if (this.circuitBreaker.isOpen()) {
      return this.handleOpenBreaker(orgId, requestId, node, requestType, params);
    }

    try {
      const response = await this.executeWithRetry(params);
      this.circuitBreaker.recordSuccess();
      return response;
    } catch (error) {
      this.circuitBreaker.recordFailure();

      if (this.circuitBreaker.isOpen()) {
        return this.handleOpenBreaker(orgId, requestId, node, requestType, params);
      }

      throw error;
    }
  }

  private async executeWithRetry(
    params: OpenAI.Chat.ChatCompletionCreateParams,
  ): Promise<OpenAI.Chat.ChatCompletion> {
    let attempt = 0;
    while (true) {
      try {
        return (await this.openai.chat.completions.create(params)) as OpenAI.Chat.ChatCompletion;
      } catch (error: unknown) {
        const isTransient = this.isTransientError(error);
        if (!isTransient || attempt >= 1) {
          throw error;
        }

        attempt++;
        const delayMs = this.backoffService.calculateWaitMs(attempt);
        this.logger.warn({
          event: 'llm_transient_error_retry',
          attempt,
          delayMs,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  private isTransientError(error: unknown): boolean {
    if (
      error instanceof OpenAI.APIConnectionError ||
      error instanceof OpenAI.APIConnectionTimeoutError
    ) {
      return true;
    }
    if (error instanceof OpenAI.APIError) {
      const status = error.status;
      if (status === 429 || (status !== undefined && status >= 500)) {
        return true;
      }
    }
    return false;
  }

  private async handleOpenBreaker(
    orgId: string,
    requestId: string,
    node: string,
    requestType: string,
    params: OpenAI.Chat.ChatCompletionCreateParams,
  ): Promise<OpenAI.Chat.ChatCompletion> {
    if (env.DEMO_MODE) {
      this.logger.warn({ event: 'llm_demo_fixture_replay', requestId, node, requestType });
      await this.eventsService.emit({
        eventName: 'stage.error',
        orgId,
        requestId,
        attributes: { node, reason: 'llm_timeout_fixture_replay', escalated_to_human: false },
      });

      const fixture = this.getFixture(requestType);
      if (!fixture) {
        this.logger.error({ event: 'llm_demo_fixture_missing', requestType });
        throw new CircuitBreakerOpenError();
      }

      // Return synthetic OpenAI-like response payload containing the extracted fixture data
      return {
        id: 'chatcmpl-fixture',
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: params.model || env.LLM_MODEL || 'qwen-72b',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify(
                fixture.extracted_fields || fixture.expected_catalog_matches || {},
              ),
              refusal: null,
            },
            finish_reason: 'stop',
            logprobs: null,
          },
        ],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      } as OpenAI.Chat.ChatCompletion;
    }

    await this.eventsService.emit({
      eventName: 'stage.error',
      orgId,
      requestId,
      attributes: { node, reason: 'llm_circuit_open', escalated_to_human: true },
    });

    throw new CircuitBreakerOpenError();
  }
}
