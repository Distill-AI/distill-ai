import { env } from '@config/env';
import * as Sentry from '@sentry/nestjs';

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    sendDefaultPii: false,
  });
}
