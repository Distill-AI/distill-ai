import { env } from '@config/env';
import * as Sentry from '@sentry/nestjs';
import { initTracing } from '@common/telemetry/tracing';

// Always register our own always-on tracer provider so request spans and trace ids exist for
// correlation regardless of whether Sentry is configured. Sentry's tracing is off unless a sample
// rate is set, so relying on it would leave logs without a trace id in the common case.
initTracing();

if (env.SENTRY_DSN) {
  // `skipOpenTelemetrySetup` stops Sentry from registering a competing provider/propagator; error
  // capture (captureException) still works and rides on the provider we just registered.
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    sendDefaultPii: false,
    skipOpenTelemetrySetup: true,
  });
}
