import { ToolsModule } from './modules/tools/tools.module';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { redisConfig } from '@config/redis.config';
import { env } from '@config/env';
import { LoggerModule } from '@common/logger/logger.module';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import { RequestIdMiddleware } from '@common/middleware/request-id.middleware';

// ── Core infrastructure ────────────────────────────────────────────────────
import { RedisModule } from '@modules/redis/redis.module';
import { HealthModule } from '@modules/health/health.module';

// ── Reference feature modules (keep, extend, or delete as you build) ───────
import { JobsModule } from '@modules/jobs/jobs.module';
import { DlqModule } from '@modules/dlq/dlq.module';
import { SchedulerModule } from '@modules/scheduler/scheduler.module';
import { BenchmarkModule } from '@modules/benchmark/benchmark.module';
import { PipelineModule } from '@modules/pipeline/pipeline.module';
import { EventsModule } from '@modules/events/events.module';
import { SseModule } from './sse/sse.module';
import { RequestsModule } from '@modules/requests/requests.module';

// ── Auth ───────────────────────────────────────────────────────
import { AuthModule } from '@modules/auth';
import { AuthGuard } from '@modules/auth';
import { RlsContextMiddleware } from '@modules/auth/middleware/rls-context.middleware';

@Module({
  imports: [
    // ── Framework setup ──────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [redisConfig],
    }),
    EventEmitterModule.forRoot({ maxListeners: 50 }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: env.DATABASE_HOST,
      port: env.DATABASE_PORT,
      username: env.DATABASE_USER,
      password: env.DATABASE_PASSWORD,
      database: env.DATABASE_NAME,
      entities: [__dirname + '/**/*.entity.js'],
      synchronize: env.DATABASE_SYNC,
      logging: env.DATABASE_LOGGING,
      ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false,
    }),

    // ── Core infrastructure ───────────────────────────────────────────────
    LoggerModule,
    RedisModule,
    HealthModule,

    // ── Feature modules — add yours here, remove the reference ones ───────
    AuthModule,
    // ── Feature modules , add yours here, remove the reference ones ───────
    JobsModule,
    DlqModule,
    SchedulerModule,
    BenchmarkModule,
    ToolsModule,
    PipelineModule,
    SseModule,
    EventsModule,
    RequestsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware, RlsContextMiddleware).forRoutes('*');
  }
}
