import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CircuitBreakerService } from './circuit-breaker.service';
import { BackoffService } from '@worker/backoff.service';
import { EventsService } from '@modules/events/events.service';
import { CircuitBreakerOpenError } from './pipeline.errors';
import { StageErrorReason } from '@constants/events.constants';
import { env } from '@config/env';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class LlmClientService implements OnModuleInit {
  private readonly logger = new Logger(LlmClientService.name);
  private openai: OpenAI;
  private catalogFixtures: Record<string, unknown>[] | null = null;

  constructor(
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly backoffService: BackoffService,
    private readonly eventsService: EventsService,
  ) {
    this.openai = new OpenAI({
      apiKey: env.DEMO_MODE ? 'demo-placeholder' : env.LLM_API_KEY!,
      baseURL: env.LLM_BASE_URL,
      timeout: env.LLM_TIMEOUT_MS,
    });
    if (!env.DEMO_MODE && !env.LLM_BASE_URL) {
      this.logger.warn({
        event: 'llm_base_url_unset',
        message:
          'LLM_BASE_URL is not set; the OpenAI SDK will default to https://api.openai.com/v1. ' +
          'Set LLM_BASE_URL explicitly if using a non-OpenAI provider (e.g. qwen-72b).',
      });
    }
  }

  async onModuleInit(): Promise<void> {
    if (env.DEMO_MODE) {
      await this.loadFixtures();
    }
  }

  /** Sends a chat completion request, routing through the circuit breaker and retry logic. */
  async createChatCompletion(
    params: OpenAI.Chat.ChatCompletionCreateParams,
    context: { orgId: string; requestId: string; node: string; requestType?: string },
  ): Promise<OpenAI.Chat.ChatCompletion> {
    const { orgId, requestId, node, requestType = 'catalog_rfq' } = context;

    if (await this.circuitBreaker.isOpen()) {
      return this.handleOpenBreaker(orgId, requestId, node, requestType, params);
    }

    try {
      const response = await this.executeWithRetry(params);
      await this.circuitBreaker.recordSuccess();
      return response;
    } catch (error) {
      const isTransient = this.isTransientError(error);
      if (isTransient) {
        await this.circuitBreaker.recordFailure();
      }

      if (isTransient && (await this.circuitBreaker.isOpen())) {
        return this.handleOpenBreaker(orgId, requestId, node, requestType, params);
      }

      throw error;
    }
  }

  private async loadFixtures(): Promise<void> {
    if (this.catalogFixtures) return;
    try {
      const catalogPath = path.resolve(process.cwd(), 'catalog.json');
      const data = await fs.promises.readFile(catalogPath, 'utf8');
      this.catalogFixtures = JSON.parse(data) as Record<string, unknown>[];
    } catch (err) {
      this.logger.warn({ event: 'demo_fixture_load_failed', error: (err as Error).message });
      this.catalogFixtures = [];
    }
  }

  private getFixture(requestType: string): Record<string, unknown> | undefined {
    const fixtures = this.catalogFixtures || [];
    return (
      fixtures.find((f) => (f._meta as Record<string, unknown>)?.request_type === requestType) ||
      fixtures.find(
        (f) => (f._meta as Record<string, unknown>)?.sample_id === 'rfq_01_catalog_clean',
      )
    );
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
        if (!isTransient || attempt >= env.LLM_MAX_RETRIES) {
          throw error;
        }

        attempt++;
        const delayMs = this.backoffService.applyJitter(
          this.backoffService.calculateWaitMs(attempt),
        );
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
      const fixture = this.getFixture(requestType);
      if (!fixture) {
        this.logger.error({ event: 'llm_demo_fixture_missing', requestType });
        // Must emit stage.error before throwing: catch-blocks skip the emit trusting this invariant.
        await this.eventsService.emit({
          eventName: 'stage.error',
          orgId,
          requestId,
          attributes: {
            stage: node,
            reason: StageErrorReason.LLM_CIRCUIT_OPEN,
            escalated_to_human: true,
          },
        });
        throw new CircuitBreakerOpenError();
      }

      this.logger.warn({ event: 'llm_demo_fixture_replay', requestId, node, requestType });
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
      attributes: {
        stage: node,
        reason: StageErrorReason.LLM_CIRCUIT_OPEN,
        escalated_to_human: true,
      },
    });

    throw new CircuitBreakerOpenError();
  }
}
