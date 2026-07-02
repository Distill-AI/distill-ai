import 'reflect-metadata';
import type { CallHandler, ExecutionContext, MessageEvent } from '@nestjs/common';
import { Controller, HttpStatus, Sse } from '@nestjs/common';
import { SSE_METADATA } from '@nestjs/common/constants';
import { firstValueFrom, of, lastValueFrom, toArray } from 'rxjs';
import { TransformInterceptor } from '../transform.interceptor';

type Handler = (...args: unknown[]) => unknown;

// A controller decorated with the REAL @Sse() so the regression test exercises the actual decorator
// rather than a hand-set metadata key. If a Nest upgrade changes how @Sse() marks handlers, the
// interceptor's detection breaks and the regression test below fails loudly (issue #85 review).
@Controller('regression')
class RealSseController {
  @Sse('events')
  events() {
    return of<MessageEvent>({ type: 'node.entered', data: { node: 'parse' } });
  }
}

function makeContext(handler: Handler, statusCode = HttpStatus.OK): ExecutionContext {
  return {
    switchToHttp: () => ({ getResponse: () => ({ statusCode }) }),
    getHandler: () => handler,
    getClass: () => ({}) as never,
    switchToRpc: () => {
      throw new Error('not implemented');
    },
    switchToWs: () => {
      throw new Error('not implemented');
    },
  } as unknown as ExecutionContext;
}

function makeCallHandler<T>(...values: T[]): CallHandler<T> {
  return { handle: () => of(...values) } as CallHandler<T>;
}

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  describe('@Sse() handlers (issue #85)', () => {
    // The SSE serializer keys off the top-level `type` to write the `event:` line; the interceptor
    // must not wrap these MessageEvents or the browser only ever fires the default `message` event.
    function sseHandler() {
      return {};
    }
    Reflect.defineMetadata(SSE_METADATA, true, sseHandler);

    it('passes a MessageEvent through untouched, without an envelope', async () => {
      const event: MessageEvent = {
        type: 'node.entered',
        data: { request_id: 'req-1', node: 'classify', status: 'processing' },
      };
      const context = makeContext(sseHandler);

      const result = await firstValueFrom(interceptor.intercept(context, makeCallHandler(event)));

      // Exact same shape, no `success`/`statusCode`/`message` envelope keys added.
      expect(result).toEqual(event);
      expect(result).not.toHaveProperty('success');
      expect(result).not.toHaveProperty('statusCode');
    });

    it('detects a handler decorated with the real @Sse() (regression guard for Nest upgrades)', async () => {
      // Uses the actual @Sse() decorator, not a hand-set key: if Nest changes how it marks SSE
      // handlers, this passthrough assertion fails and the wrapping regression is caught early.
      const context = makeContext(RealSseController.prototype.events as Handler);
      const event: MessageEvent = { type: 'node.entered', data: { node: 'parse' } };

      const result = await firstValueFrom(interceptor.intercept(context, makeCallHandler(event)));

      expect(result).toEqual(event);
      expect(result).not.toHaveProperty('success');
    });

    it('preserves every emitted event in order for a multi-event stream', async () => {
      const events: MessageEvent[] = [
        { type: 'node.entered', data: { request_id: 'req-1', node: 'parse' } },
        { type: 'request.resumed', data: { request_id: 'req-1', resumed_from_node: 'classify' } },
        { type: 'processing.complete', data: { request_id: 'req-1', status: 'success' } },
      ];
      const context = makeContext(sseHandler);

      const emitted = await lastValueFrom(
        interceptor.intercept(context, makeCallHandler(...events)).pipe(toArray()),
      );

      expect(emitted).toEqual(events);
    });
  });

  describe('non-SSE handlers', () => {
    function jsonHandler() {
      return {};
    }

    it('wraps a plain payload in the standard success envelope', async () => {
      const context = makeContext(jsonHandler, HttpStatus.OK);

      const result = await firstValueFrom(
        interceptor.intercept(context, makeCallHandler({ id: 1 })),
      );

      expect(result).toEqual({
        success: true,
        statusCode: HttpStatus.OK,
        message: 'Operation successful',
        data: { id: 1 },
      });
    });

    it('unwraps a structured { statusCode, message, data } payload', async () => {
      const context = makeContext(jsonHandler, HttpStatus.OK);
      const payload = { statusCode: HttpStatus.CREATED, message: 'Created', data: { id: 2 } };

      const result = await firstValueFrom(interceptor.intercept(context, makeCallHandler(payload)));

      expect(result).toEqual({
        success: true,
        statusCode: HttpStatus.CREATED,
        message: 'Created',
        data: { id: 2 },
      });
    });

    it('does not treat a MessageEvent-shaped payload as SSE when the handler is not @Sse()', async () => {
      // A normal JSON body that happens to have `type`/`data` keys must still be wrapped, proving
      // the guard keys off handler metadata rather than payload shape.
      const context = makeContext(jsonHandler, HttpStatus.OK);
      const payload = { type: 'node.entered', data: { node: 'classify' } };

      const result = await firstValueFrom(interceptor.intercept(context, makeCallHandler(payload)));

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data', payload);
    });
  });
});
