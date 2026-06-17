type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  data?: unknown;
}

const isDev = import.meta.env.DEV;

function send(entry: LogEntry) {
  if (!isDev) {
    // Production: swap this block for your logging service (Sentry, Datadog, etc.)
    // Example: Sentry.captureMessage(entry.message, { level: entry.level, extra: entry.data });
    if (entry.level === 'error' || entry.level === 'warn') {
      // eslint-disable-next-line no-console
      console[entry.level](`[${entry.context ?? 'app'}]`, entry.message, entry.data ?? '');
    }
    return;
  }

  const prefix = entry.context ? `[${entry.context}]` : '[app]';
  const args = entry.data !== undefined ? [entry.message, entry.data] : [entry.message];

  // eslint-disable-next-line no-console
  console[entry.level](prefix, ...args);
}

function makeLogger(context?: string) {
  return {
    debug: (message: string, data?: unknown) => send({ level: 'debug', message, context, data }),
    info: (message: string, data?: unknown) => send({ level: 'info', message, context, data }),
    warn: (message: string, data?: unknown) => send({ level: 'warn', message, context, data }),
    error: (message: string, data?: unknown) => send({ level: 'error', message, context, data }),
  };
}

/** Root logger — use this directly or create a scoped child with logger.child(). */
const logger = {
  ...makeLogger(),
  /** Returns a logger scoped to a specific context label. */
  child: (context: string) => makeLogger(context),
};

export default logger;
