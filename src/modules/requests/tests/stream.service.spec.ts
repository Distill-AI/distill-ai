import { MessageEvent } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as SYS_MSG from '@constants/system-messages';
import { SseService } from '../../../sse/sse.service';
import { EventsService } from '../../events/events.service';
import { AuditEventModelAction } from '../../events/audit-event.model-action';
import { StreamService } from '../services/stream.service';
import { StreamNode } from '../enums/stream-node.enum';
import { StreamToolStatus } from '../enums/stream-tool-status.enum';
import { NodeExitStatus } from '../enums/node-exit-status.enum';

function makeStreamService(): {
  service: StreamService;
  events: EventsService;
  emitter: EventEmitter2;
} {
  const emitter = new EventEmitter2();
  const sse = new SseService(emitter);
  const auditEvents = {
    create: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditEventModelAction;
  const events = new EventsService(auditEvents, sse);
  const service = new StreamService(events, sse);
  return { service, events, emitter };
}

describe('StreamService', () => {
  describe('AC1: emitNodeEntered', () => {
    it('sends node.entered event with correct shape', async () => {
      const { service, events } = makeStreamService();
      const emitSpy = vi.spyOn(events, 'emit');

      service.emitNodeEntered('req-1', StreamNode.PARSE, 'org-1');
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(emitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'node.entered',
          requestId: 'req-1',
          attributes: expect.objectContaining({
            type: 'node.entered',
            node: StreamNode.PARSE,
            status: 'processing',
          }),
        }),
      );
    });
  });

  describe('AC1: emitNodeExited', () => {
    it('includes duration_ms and summary in node.exited event', async () => {
      const { service, events } = makeStreamService();
      const emitSpy = vi.spyOn(events, 'emit');

      service.emitNodeExited(
        'req-1',
        StreamNode.EXTRACT,
        NodeExitStatus.SUCCESS,
        2000,
        'Extracted 14 line items',
        'org-1',
      );
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(emitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'node.exited',
          requestId: 'req-1',
          attributes: expect.objectContaining({
            type: 'node.exited',
            node: StreamNode.EXTRACT,
            status: NodeExitStatus.SUCCESS,
            duration_ms: 2000,
            summary: 'Extracted 14 line items',
          }),
        }),
      );
    });
  });

  describe('AC2: emitToolInvoked', () => {
    it('includes tool_name, attempt, and result_summary', async () => {
      const { service, events } = makeStreamService();
      const emitSpy = vi.spyOn(events, 'emit');

      service.emitToolInvoked(
        'req-1',
        StreamNode.MATCH,
        'semantic_search',
        StreamToolStatus.SUCCESS,
        2,
        'Found 14 matching SKUs',
        'org-1',
      );
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(emitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'tool.invoked',
          requestId: 'req-1',
          attributes: expect.objectContaining({
            type: 'tool.invoked',
            node: StreamNode.MATCH,
            tool_name: 'semantic_search',
            status: StreamToolStatus.SUCCESS,
            attempt: 2,
            result_summary: 'Found 14 matching SKUs',
          }),
        }),
      );
    });
  });

  describe('AC1: emitProcessingComplete cleans up', () => {
    it('emits processing.complete and does not leak stream reference', async () => {
      const { service, events } = makeStreamService();
      const emitSpy = vi.spyOn(events, 'emit');

      service.emitProcessingComplete('req-1', NodeExitStatus.SUCCESS, 10000, 'org-1');
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(emitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'processing.complete',
          requestId: 'req-1',
          attributes: expect.objectContaining({
            type: 'processing.complete',
            status: NodeExitStatus.SUCCESS,
            total_duration_ms: 10000,
          }),
        }),
      );
    });
  });

  describe('AC1: subscribe filters by requestId', () => {
    it('returns only events matching the given requestId', async () => {
      const { service, emitter } = makeStreamService();
      const received: MessageEvent[] = [];

      const sub = service.subscribe('req-1').subscribe({
        next: (msg: MessageEvent) => received.push(msg),
      });

      const t0 = new Date().toISOString();

      emitter.emit('job_event', {
        event: 'node.entered',
        data: {
          request_id: 'req-1',
          type: 'node.entered',
          node: 'parse',
          status: 'processing',
          timestamp: t0,
        },
      });
      emitter.emit('job_event', {
        event: 'node.entered',
        data: {
          request_id: 'req-2',
          type: 'node.entered',
          node: 'parse',
          status: 'processing',
          timestamp: t0,
        },
      });
      emitter.emit('job_event', {
        event: 'node.exited',
        data: {
          request_id: 'req-1',
          type: 'node.exited',
          node: 'parse',
          status: 'success',
          duration_ms: 500,
          summary: 'Done',
          timestamp: t0,
        },
      });

      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(received).toHaveLength(2);
      expect(received[0].type).toBe('node.entered');
      expect(received[1].type).toBe('node.exited');
      for (const r of received) {
        const d = (r.data ?? {}) as Record<string, unknown>;
        expect(d.request_id).toBe('req-1');
      }

      sub.unsubscribe();
    });
  });

  describe('EC1: subscribe cleans up on unsubscribe', () => {
    it('removes listener on unsubscribe', async () => {
      const { service, emitter } = makeStreamService();

      const sub = service.subscribe('req-1').subscribe(() => {});
      expect(emitter.listenerCount('job_event')).toBe(1);

      sub.unsubscribe();
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(emitter.listenerCount('job_event')).toBe(0);
    });
  });

  describe('AC3: sanitization strips raw model reasoning', () => {
    it('replaces chain-of-thought summaries with placeholder', async () => {
      const { service, events } = makeStreamService();
      const emitSpy = vi.spyOn(events, 'emit');

      service.emitNodeExited(
        'req-1',
        StreamNode.EXTRACT,
        NodeExitStatus.FAILED,
        1500,
        'Let me think about this step by step: first I need to extract the data',
        'org-1',
      );
      await new Promise<void>((resolve) => setImmediate(resolve));

      const call = emitSpy.mock.calls[0][0] as unknown as Record<string, unknown>;
      const attrs = call.attributes as unknown as Record<string, unknown>;
      expect(attrs.summary).toBe(SYS_MSG.SANITIZED_SUMMARY_PLACEHOLDER);
    });

    it('passes through clean summaries unchanged', async () => {
      const { service, events } = makeStreamService();
      const emitSpy = vi.spyOn(events, 'emit');

      service.emitNodeExited(
        'req-1',
        StreamNode.PARSE,
        NodeExitStatus.SUCCESS,
        1000,
        'Parsed email + 1 attachment',
        'org-1',
      );
      await new Promise<void>((resolve) => setImmediate(resolve));

      const call = emitSpy.mock.calls[0][0] as unknown as Record<string, unknown>;
      const attrs = call.attributes as unknown as Record<string, unknown>;
      expect(attrs.summary).toBe('Parsed email + 1 attachment');
    });

    it('redacts error_detail and raw_output fields', async () => {
      const { events } = makeStreamService();
      const emitSpy = vi.spyOn(events, 'emit');
      // Emit with fields that should be redacted
      events.emit({
        eventName: 'tool.invoked',
        requestId: 'req-1',
        orgId: 'org-1',
        attributes: {
          type: 'tool.invoked',
          node: StreamNode.EXTRACT,
          tool_name: 'catalog_search',
          status: StreamToolStatus.FAILED,
          attempt: 1,
          result_summary: 'Error: something broke',
          error_detail: 'Stack trace here',
          raw_output: 'Raw model output here',
        },
      });
      await new Promise<void>((resolve) => setImmediate(resolve));

      const call = emitSpy.mock.calls[0][0] as unknown as Record<string, unknown>;
      const attrs = call.attributes as unknown as Record<string, unknown>;
      expect(attrs.result_summary).toBe('Error: something broke');
      expect(attrs.error_detail).toBeUndefined();
      expect(attrs.raw_output).toBeUndefined();
    });
  });

  describe('SEC2: subscribe sanitizer deep-cleans event data', () => {
    it('strips raw model reasoning from summaries in SSE stream', async () => {
      const { service, emitter } = makeStreamService();
      const received: MessageEvent[] = [];

      const sub = service.subscribe('req-san').subscribe({
        next: (msg: MessageEvent) => received.push(msg),
      });

      emitter.emit('job_event', {
        event: 'node.exited',
        data: {
          request_id: 'req-san',
          type: 'node.exited',
          node: 'extract',
          status: 'failed',
          duration_ms: 500,
          summary: 'Let me think about this step by step',
          timestamp: new Date().toISOString(),
        },
      });

      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(received).toHaveLength(1);

      const payload = received[0].data as Record<string, unknown>;
      expect(payload.summary).toBe(SYS_MSG.SANITIZED_SUMMARY_PLACEHOLDER);
      expect(payload.chain_of_thought).toBeUndefined();
      expect(payload.raw_output).toBeUndefined();

      sub.unsubscribe();
    });
  });

  describe('SEC4: connection timeout removes listener', () => {
    it('removes the emitter listener when subscription ends', async () => {
      const { service, emitter } = makeStreamService();

      const sub = service.subscribe('req-timeout').subscribe(() => {});
      expect(emitter.listenerCount('job_event')).toBe(1);

      sub.unsubscribe();
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(emitter.listenerCount('job_event')).toBe(0);
    });
  });
});
