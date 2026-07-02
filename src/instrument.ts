import { env } from '@config/env';
import * as Sentry from '@sentry/nestjs';
import { initTracing } from '@common/telemetry/tracing';

if (env.SENTRY_DSN) {
  // Sentry registers its own OpenTelemetry tracer provider + propagator, so we don't add ours.
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    sendDefaultPii: false,
  });
} else {
  // No Sentry: register our own provider so request spans/trace ids still exist for correlation.
  initTracing();
}
