import { Module } from '@nestjs/common';
import { RedisModule } from '@modules/redis/redis.module';
import { EventsModule } from '@modules/events/events.module';
import { BackoffService } from '@worker/backoff.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { LlmClientService } from './llm-client.service';

@Module({
  imports: [RedisModule, EventsModule],
  providers: [CircuitBreakerService, LlmClientService, BackoffService],
  exports: [LlmClientService, CircuitBreakerService],
})
export class LlmModule {}
