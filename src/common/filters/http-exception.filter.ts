import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/nestjs';
import * as SYS_MSG from '@constants/system-messages';
import { LoggerContextService } from '@common/logger/logger-context.service';

type ErrorBody = {
  success: false;
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
  details?: unknown;
};

const INTERNAL_SERVER_ERROR_THRESHOLD = 500;

@Injectable()
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly loggerContext: LoggerContextService) {}

  /** Normalises all thrown exceptions into a structured error response and captures genuine faults in Sentry. */
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const payload = this.normalizeError(exception);

    const logMessage = `${request.method} ${request.url} → ${payload.statusCode}`;
    if (payload.statusCode >= INTERNAL_SERVER_ERROR_THRESHOLD) {
      this.logger.error(logMessage, exception instanceof Error ? exception.stack : undefined);

      // Only send genuine faults to Sentry — skip deliberate 5xx HttpExceptions (e.g. 503 from health checks).
      if (
        !(exception instanceof HttpException) ||
        payload.statusCode === HttpStatus.INTERNAL_SERVER_ERROR
      ) {
        const requestId = this.loggerContext.getRequestId();
        Sentry.withScope((scope) => {
          if (requestId) scope.setTag('request_id', requestId);
          scope.setExtra('path', request.path);
          scope.setExtra('method', request.method);
          Sentry.captureException(exception);
        });
      }
    } else {
      this.logger.warn(logMessage);
    }

    if (response.headersSent) {
      this.logger.error(
        `Headers already sent, cannot write error response: ${request.method} ${request.url}`,
      );
      return;
    }

    const body: ErrorBody = {
      ...payload,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(payload.statusCode).json(body);
  }

  private normalizeError(exception: unknown): Omit<ErrorBody, 'path' | 'timestamp'> {
    if (exception instanceof HttpException) {
      return this.normalizeHttpException(exception);
    }

    return {
      success: false,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: SYS_MSG.HTTP_INTERNAL_SERVER_ERROR_NAME,
      message: SYS_MSG.HTTP_INTERNAL_SERVER_ERROR,
    };
  }

  private normalizeHttpException(exception: HttpException): Omit<ErrorBody, 'path' | 'timestamp'> {
    const statusCode = exception.getStatus();

    // Only mask details for 500 — other 5xx (e.g. 503) carry meaningful context.
    if (statusCode === HttpStatus.INTERNAL_SERVER_ERROR) {
      return {
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: SYS_MSG.HTTP_INTERNAL_SERVER_ERROR_NAME,
        message: SYS_MSG.HTTP_INTERNAL_SERVER_ERROR,
      };
    }

    const response = exception.getResponse();

    if (typeof response === 'string') {
      return {
        success: false,
        statusCode,
        error: exception.name,
        message: response,
      };
    }

    if (typeof response === 'object' && response !== null) {
      const body = response as Record<string, unknown>;
      return {
        success: false,
        statusCode,
        error: (body.error as string) ?? exception.name,
        message: (body.message as string | string[]) ?? SYS_MSG.VALIDATION_FAILED,
        details: body.details ?? body.errors,
      };
    }

    return {
      success: false,
      statusCode,
      error: exception.name,
      message: exception.message,
    };
  }
}
