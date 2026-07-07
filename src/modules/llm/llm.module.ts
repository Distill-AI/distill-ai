import { Module } from '@nestjs/common';
import { RedisModule } from '@modules/redis/redis.module';
import { EventsModule } from '@modules/events/events.module';
import { BackoffService } from '@worker/backoff.service';
import { LLMProvider } from './llm.provider';
import { CircuitBreakerService } from './circuit-breaker.service';
import { LlmClientService } from './llm-client.service';

@Module({
  providers: [LLMProvider],
  exports: [LLMProvider],
})
export class LLMModule {}

/**
 * Provides the LLM client and circuit breaker as a self-contained unit. Consumers migrate to
 * this module from `LLMModule` incrementally; `LLMModule`/`LLMProvider` are deleted once the
 * last consumer switches over.
 */
@Module({
  imports: [RedisModule, EventsModule],
  providers: [CircuitBreakerService, LlmClientService, BackoffService],
  exports: [LlmClientService, CircuitBreakerService],
})
export class LlmModule {}
