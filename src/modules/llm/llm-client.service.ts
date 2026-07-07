import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CircuitBreakerService, CircuitBreakerState } from './circuit-breaker.service';
import { BackoffService } from '@worker/backoff.service';
import { EventsService } from '@modules/events/events.service';
import { CircuitBreakerOpenError } from '@modules/pipeline/pipeline.errors';
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

    // Keys-removed guarantee (NFR-OPS-4): never attempt a live call in DEMO_MODE, even while the
    // breaker is CLOSED - otherwise a demo deployment without LLM_BASE_URL pointed at a working
    // endpoint would make a real network call on every request instead of replaying fixtures.
    if (env.DEMO_MODE) {
      return this.handleOpenBreaker(orgId, requestId, node, requestType, params);
    }

    // Capture admission-time state before the gate call: if this caller is admitted while the
    // breaker is HALF_OPEN, it is the one call that acquired the probe lock (isOpen() only
    // returns false in HALF_OPEN for the lock holder). Freezing that here, rather than
    // re-deriving it from the breaker's live state after the network round trip, avoids
    // misattributing probe ownership to a straggler call that was admitted while CLOSED but
    // whose catch block happens to run after some other, unrelated failure has since tripped the
    // breaker into HALF_OPEN.
    const stateAtAdmission = await this.circuitBreaker.getState();
    if (await this.circuitBreaker.isOpen()) {
      return this.handleOpenBreaker(orgId, requestId, node, requestType, params);
    }
    const isProbe = stateAtAdmission === CircuitBreakerState.HALF_OPEN;

    try {
      const response = await this.executeWithRetry(params);
      await this.circuitBreaker.recordSuccess();
      return response;
    } catch (error) {
      const isTransient = this.isTransientError(error);
      // A HALF_OPEN probe must resolve the breaker either way: a non-transient failure (e.g. 4xx)
      // still needs recordFailure() to release the probe lock, or the lock sits until
      // PROBE_LOCK_TTL_S expires and every other caller is blocked as if the breaker were OPEN.
      if (isTransient || isProbe) {
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
      const seedDir = path.resolve(process.cwd(), 'src/database/seed');
      const filenames = await fs.promises.readdir(seedDir);
      const jsonFiles = filenames.filter((f) => f.endsWith('.json')).sort();
      const fixtures: Record<string, unknown>[] = [];
      for (const file of jsonFiles) {
        try {
          const raw = await fs.promises.readFile(path.join(seedDir, file), 'utf8');
          fixtures.push(JSON.parse(raw) as Record<string, unknown>);
        } catch (err) {
          this.logger.warn({
            event: 'demo_fixture_file_parse_failed',
            file,
            error: (err as Error).message,
          });
        }
      }
      this.catalogFixtures = fixtures;
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
