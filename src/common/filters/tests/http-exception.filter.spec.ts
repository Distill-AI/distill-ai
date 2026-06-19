import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from '../http-exception.filter';
import { LoggerContextService } from '@common/logger/logger-context.service';

const mockScope = { setTag: vi.fn(), setExtra: vi.fn() };

vi.mock('@sentry/nestjs', () => ({
  withScope: vi.fn((cb: (scope: unknown) => void) => cb(mockScope)),
  captureException: vi.fn(),
}));

import * as Sentry from '@sentry/nestjs';

const mockLoggerContext = {
  getRequestId: vi.fn(),
} as unknown as LoggerContextService;

function buildHost() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const response = { headersSent: false, status } as unknown as Response;
  const request = { method: 'GET', url: '/test' } as unknown as Request;
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  };
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    vi.clearAllMocks();
    filter = new HttpExceptionFilter(mockLoggerContext);
  });

  describe('Sentry capture', () => {
    it('calls withScope for a non-HttpException (500 path)', () => {
      vi.mocked(mockLoggerContext.getRequestId).mockReturnValue('req-abc-123');

      filter.catch(new Error('boom'), buildHost() as never);

      expect(Sentry.withScope).toHaveBeenCalledTimes(1);
    });

    it('attaches request_id tag when one is available', () => {
      vi.mocked(mockLoggerContext.getRequestId).mockReturnValue('req-abc-123');

      filter.catch(new Error('boom'), buildHost() as never);

      expect(mockScope.setTag).toHaveBeenCalledWith('request_id', 'req-abc-123');
    });

    it('does not set request_id tag when none is available', () => {
      vi.mocked(mockLoggerContext.getRequestId).mockReturnValue(null);

      filter.catch(new Error('boom'), buildHost() as never);

      expect(mockScope.setTag).not.toHaveBeenCalled();
    });

    it('does NOT call withScope for a 404 HttpException', () => {
      vi.mocked(mockLoggerContext.getRequestId).mockReturnValue('req-abc-123');

      filter.catch(new HttpException('Not found', HttpStatus.NOT_FOUND), buildHost() as never);

      expect(Sentry.withScope).not.toHaveBeenCalled();
    });

    it('does NOT call withScope for a 400 HttpException', () => {
      vi.mocked(mockLoggerContext.getRequestId).mockReturnValue('req-abc-123');

      filter.catch(new HttpException('Bad request', HttpStatus.BAD_REQUEST), buildHost() as never);

      expect(Sentry.withScope).not.toHaveBeenCalled();
    });

    it('does NOT call withScope for a deliberate 503 HttpException (e.g. health check degradation)', () => {
      vi.mocked(mockLoggerContext.getRequestId).mockReturnValue('req-abc-123');

      filter.catch(
        new HttpException('Service Unavailable', HttpStatus.SERVICE_UNAVAILABLE),
        buildHost() as never,
      );

      expect(Sentry.withScope).not.toHaveBeenCalled();
    });
  });
});
