import './instrument'; // must be first — same Sentry init as the API process; must not transitively import @Injectable/@Module classes (reflect-metadata not yet loaded)
import 'reflect-metadata';
import * as Sentry from '@sentry/nestjs';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';
import { PinoLoggerService } from './common/logger/pino-logger.service';

async function bootstrap() {
  process.on('unhandledRejection', (reason) => {
    Sentry.captureException(reason);
  });

  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });

  // Wire Pino as the NestJS logger. This also flushes any logs that were
  // buffered during createApplicationContext initialisation.
  app.useLogger(app.get(PinoLoggerService));

  app.enableShutdownHooks();
}

void bootstrap();
