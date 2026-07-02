import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { SSE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { map, Observable } from 'rxjs';

export interface ApiResponse<T> {
  success: true;
  statusCode: number;
  message?: string;
  data: T;
  meta?: Record<string, unknown>;
}

interface StructuredPayload {
  statusCode: number;
  message: string;
  data?: unknown;
  [key: string]: unknown;
}

function isStructuredPayload(value: unknown): value is StructuredPayload {
  if (value === null || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    'statusCode' in obj &&
    'message' in obj &&
    typeof obj['statusCode'] === 'number' &&
    typeof obj['message'] === 'string'
  );
}

function defaultMessageFor(statusCode: HttpStatus): string {
  switch (statusCode) {
    case HttpStatus.CREATED:
      return 'Resource created successfully';
    case HttpStatus.NO_CONTENT:
      return 'No content';
    default:
      return 'Operation successful';
  }
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  private readonly reflector = new Reflector();

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    // This global interceptor also runs on @Sse() handlers. Wrapping each streamed MessageEvent
    // ({ type, data }) in the standard envelope drops the top-level `type`, so Nest's SseStream
    // never writes the `event:` line and the browser only ever fires the default `message` event.
    // Pass SSE responses through untouched so named events reach EventSource listeners (issue #85).
    if (this.reflector.get<boolean>(SSE_METADATA, context.getHandler())) {
      return next.handle() as unknown as Observable<ApiResponse<T>>;
    }

    const httpResponse = context.switchToHttp().getResponse<{ statusCode?: number }>();

    return next.handle().pipe(
      map((payload) => {
        const defaultStatusCode = httpResponse?.statusCode ?? HttpStatus.OK;

        if (isStructuredPayload(payload)) {
          const { statusCode, message, data, ...rest } = payload;
          return {
            success: true as const,
            statusCode: statusCode ?? defaultStatusCode,
            message,
            data: (data === undefined ? null : data) as T,
            ...(Object.keys(rest).length > 0 ? { meta: rest } : {}),
          };
        }

        if (
          payload !== null &&
          typeof payload === 'object' &&
          Object.prototype.hasOwnProperty.call(payload, 'paginationMeta') &&
          Object.prototype.hasOwnProperty.call(payload, 'payload') &&
          (payload as Record<string, unknown>)['payload'] !== undefined
        ) {
          const {
            paginationMeta,
            payload: data,
            ...rest
          } = payload as unknown as {
            paginationMeta: Record<string, unknown>;
            payload: T;
            [key: string]: unknown;
          };
          return {
            success: true as const,
            statusCode: defaultStatusCode,
            message: defaultMessageFor(defaultStatusCode),
            data,
            meta: { ...rest, ...paginationMeta },
          };
        }

        return {
          success: true as const,
          statusCode: defaultStatusCode,
          message: defaultMessageFor(defaultStatusCode),
          data: payload,
        };
      }),
    );
  }
}
