import { Module } from '@nestjs/common';
import { RedisModule } from '@modules/redis/redis.module';
import { EventsModule } from '@modules/events/events.module';
import { BackoffService } from '@worker/backoff.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { LlmClientService } from './llm-client.service';

/**
 * Provides the LLM client and circuit breaker as a self-contained unit. Imported by
 * PipelineQueueModule so the queue module owns routing and processing, not LLM wiring.
 */
@Module({
  imports: [RedisModule, EventsModule],
  providers: [CircuitBreakerService, LlmClientService, BackoffService],
  exports: [CircuitBreakerService, LlmClientService],
})
export class PipelineEngineModule {}
