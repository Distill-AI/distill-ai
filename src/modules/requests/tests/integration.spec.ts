import { MessageEvent } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SseService } from '../../../sse/sse.service';
import { EventsService } from '../../events/events.service';
import { AuditEventModelAction } from '../../events/audit-event.model-action';
import { StreamService } from '../services/stream.service';

function buildSandbox() {
  const emitter = new EventEmitter2();
  const sse = new SseService(emitter);
  const auditEvents = {
    create: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditEventModelAction;
  const events = new EventsService(auditEvents, sse);
  const streamService = new StreamService(events, sse);
  return { emitter, sse, events, streamService };
}

function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('Integration: SSE Event Pipeline', () => {
  describe('Full pipeline: parse → extract → match → score → price → policy', () => {
    it('emits events in correct order with correct types', async () => {
      const { streamService, emitter } = buildSandbox();
      const emitted: MessageEvent[] = [];

      const sub = streamService.subscribe('req-1').subscribe({
        next: (e: MessageEvent) => emitted.push(e),
      });

      const t0 = new Date().toISOString();

      emitter.emit('job_event', {
        event: 'node.entered',
        data: {
          request_id: 'req-1',
          type: 'node.entered',
          timestamp: t0,
          node: 'parse',
          status: 'processing',
        },
      });
      emitter.emit('job_event', {
        event: 'node.exited',
        data: {
          request_id: 'req-1',
          type: 'node.exited',
          timestamp: t0,
          node: 'parse',
          status: 'success',
          duration_ms: 500,
          summary: 'Parsed email + 1 attachment',
        },
      });
      emitter.emit('job_event', {
        event: 'node.entered',
        data: {
          request_id: 'req-1',
          type: 'node.entered',
          timestamp: t0,
          node: 'extract',
          status: 'processing',
        },
      });
      emitter.emit('job_event', {
        event: 'tool.invoked',
        data: {
          request_id: 'req-1',
          type: 'tool.invoked',
          node: 'extract',
          tool_name: 'catalog_search',
          status: 'running',
          attempt: 1,
          result_summary: 'Invoking tool',
        },
      });
      emitter.emit('job_event', {
        event: 'tool.invoked',
        data: {
          request_id: 'req-1',
          type: 'tool.invoked',
          node: 'extract',
          tool_name: 'catalog_search',
          status: 'success',
          attempt: 1,
          result_summary: 'Found 14 line items',
        },
      });
      emitter.emit('job_event', {
        event: 'node.exited',
        data: {
          request_id: 'req-1',
          type: 'node.exited',
          timestamp: t0,
          node: 'extract',
          status: 'success',
          duration_ms: 3000,
          summary: 'Extraction completed',
        },
      });
      emitter.emit('job_event', {
        event: 'node.entered',
        data: {
          request_id: 'req-1',
          type: 'node.entered',
          timestamp: t0,
          node: 'match',
          status: 'processing',
        },
      });
      emitter.emit('job_event', {
        event: 'tool.invoked',
        data: {
          request_id: 'req-1',
          type: 'tool.invoked',
          node: 'match',
          tool_name: 'semantic_search',
          status: 'running',
          attempt: 1,
          result_summary: 'Invoking tool',
        },
      });
      emitter.emit('job_event', {
        event: 'tool.invoked',
        data: {
          request_id: 'req-1',
          type: 'tool.invoked',
          node: 'match',
          tool_name: 'semantic_search',
          status: 'success',
          attempt: 1,
          result_summary: 'Found 14 matching SKUs',
        },
      });
      emitter.emit('job_event', {
        event: 'node.exited',
        data: {
          request_id: 'req-1',
          type: 'node.exited',
          timestamp: t0,
          node: 'match',
          status: 'success',
          duration_ms: 2000,
          summary: 'Catalog matching completed',
        },
      });
      emitter.emit('job_event', {
        event: 'node.entered',
        data: {
          request_id: 'req-1',
          type: 'node.entered',
          timestamp: t0,
          node: 'score',
          status: 'processing',
        },
      });
      emitter.emit('job_event', {
        event: 'node.exited',
        data: {
          request_id: 'req-1',
          type: 'node.exited',
          timestamp: t0,
          node: 'score',
          status: 'success',
          duration_ms: 500,
          summary: 'Confidence scored',
        },
      });
      emitter.emit('job_event', {
        event: 'node.entered',
        data: {
          request_id: 'req-1',
          type: 'node.entered',
          timestamp: t0,
          node: 'price',
          status: 'processing',
        },
      });
      emitter.emit('job_event', {
        event: 'node.exited',
        data: {
          request_id: 'req-1',
          type: 'node.exited',
          timestamp: t0,
          node: 'price',
          status: 'success',
          duration_ms: 800,
          summary: 'Pricing rules applied',
        },
      });
      emitter.emit('job_event', {
        event: 'node.entered',
        data: {
          request_id: 'req-1',
          type: 'node.entered',
          timestamp: t0,
          node: 'policy',
          status: 'processing',
        },
      });
      emitter.emit('job_event', {
        event: 'node.exited',
        data: {
          request_id: 'req-1',
          type: 'node.exited',
          timestamp: t0,
          node: 'policy',
          status: 'success',
          duration_ms: 600,
          summary: 'Policy rules applied',
        },
      });
      emitter.emit('job_event', {
        event: 'processing.complete',
        data: {
          request_id: 'req-1',
          type: 'processing.complete',
          timestamp: t0,
          status: 'success',
          total_duration_ms: 10000,
        },
      });

      await flush();
      sub.unsubscribe();

      expect(emitted.length).toBe(17);

      const types = emitted.map((e: { event?: string; type?: string; data?: unknown }) => ({
        type: e.event ?? e.type,
        node: (e.data as Record<string, unknown> | undefined)?.node,
      }));
      expect(types[0]).toEqual({ type: 'node.entered', node: 'parse' });
      expect(types[1]).toEqual({ type: 'node.exited', node: 'parse' });
      expect(types[5]).toEqual({ type: 'node.exited', node: 'extract' });
      expect(types[6]).toEqual({ type: 'node.entered', node: 'match' });
      expect(types[16]).toEqual({ type: 'processing.complete', node: undefined });

      for (const event of emitted) {
        const data = (event.data ?? {}) as Record<string, unknown>;
        const values = Object.values(data).map((v: unknown) => String(v));
        const allText = values.join(' ');
        expect(allText).not.toContain('chain of thought');
        expect(allText).not.toContain('Let me think');
        expect(allText).not.toContain('step by step');
      }
    });
  });

  describe('Tool retry', () => {
    it('shows attempt 1 fail and attempt 2 succeed', async () => {
      const { streamService, emitter } = buildSandbox();
      const emitted: MessageEvent[] = [];

      const sub = streamService.subscribe('req-retry').subscribe({
        next: (e: MessageEvent) => emitted.push(e),
      });

      const t0 = new Date().toISOString();

      emitter.emit('job_event', {
        event: 'node.entered',
        data: {
          request_id: 'req-retry',
          type: 'node.entered',
          node: 'extract',
          status: 'processing',
          timestamp: t0,
        },
      });
      emitter.emit('job_event', {
        event: 'tool.invoked',
        data: {
          request_id: 'req-retry',
          type: 'tool.invoked',
          node: 'extract',
          tool_name: 'catalog_search',
          status: 'running',
          attempt: 1,
          result_summary: 'Invoking',
        },
      });
      emitter.emit('job_event', {
        event: 'tool.invoked',
        data: {
          request_id: 'req-retry',
          type: 'tool.invoked',
          node: 'extract',
          tool_name: 'catalog_search',
          status: 'failed',
          attempt: 1,
          result_summary: 'Connection timeout',
        },
      });
      emitter.emit('job_event', {
        event: 'tool.invoked',
        data: {
          request_id: 'req-retry',
          type: 'tool.invoked',
          node: 'extract',
          tool_name: 'catalog_search',
          status: 'retried',
          attempt: 2,
          result_summary: 'Retrying after timeout',
        },
      });
      emitter.emit('job_event', {
        event: 'tool.invoked',
        data: {
          request_id: 'req-retry',
          type: 'tool.invoked',
          node: 'extract',
          tool_name: 'catalog_search',
          status: 'success',
          attempt: 2,
          result_summary: 'Extracted 14 line items',
        },
      });

      await flush();
      sub.unsubscribe();

      const data2 = emitted[2].data as Record<string, unknown>;
      const data3 = emitted[3].data as Record<string, unknown>;
      const data4 = emitted[4].data as Record<string, unknown>;

      expect(emitted).toHaveLength(5);
      expect(data2.status).toBe('failed');
      expect(data2.attempt).toBe(1);
      expect(data3.status).toBe('retried');
      expect(data3.attempt).toBe(2);
      expect(data4.status).toBe('success');
      expect(data4.attempt).toBe(2);
    });
  });

  describe('Concurrent subscribers', () => {
    it('each subscriber receives all events for their request', async () => {
      const { streamService, emitter } = buildSandbox();

      const receivedA: MessageEvent[] = [];
      const receivedB: MessageEvent[] = [];

      const subA = streamService
        .subscribe('req-a')
        .subscribe({ next: (e: MessageEvent) => receivedA.push(e) });
      const subB = streamService
        .subscribe('req-b')
        .subscribe({ next: (e: MessageEvent) => receivedB.push(e) });

      const t0 = new Date().toISOString();

      emitter.emit('job_event', {
        event: 'node.entered',
        data: {
          request_id: 'req-a',
          type: 'node.entered',
          node: 'parse',
          status: 'processing',
          timestamp: t0,
        },
      });
      emitter.emit('job_event', {
        event: 'node.entered',
        data: {
          request_id: 'req-b',
          type: 'node.entered',
          node: 'parse',
          status: 'processing',
          timestamp: t0,
        },
      });
      emitter.emit('job_event', {
        event: 'node.exited',
        data: {
          request_id: 'req-a',
          type: 'node.exited',
          node: 'parse',
          status: 'success',
          duration_ms: 500,
          summary: 'Done',
          timestamp: t0,
        },
      });

      await flush();

      expect(receivedA).toHaveLength(2);
      expect(receivedB).toHaveLength(1);

      subA.unsubscribe();
      subB.unsubscribe();
    });
  });

  describe('Client disconnect', () => {
    it('pipeline continues to emit even after subscriber unsubscribes', async () => {
      const { streamService, emitter } = buildSandbox();

      const received: MessageEvent[] = [];
      const sub = streamService
        .subscribe('req-disconnect')
        .subscribe({ next: (e: MessageEvent) => received.push(e) });

      const t0 = new Date().toISOString();

      emitter.emit('job_event', {
        event: 'node.entered',
        data: {
          request_id: 'req-disconnect',
          type: 'node.entered',
          node: 'parse',
          status: 'processing',
          timestamp: t0,
        },
      });
      await flush();
      expect(received).toHaveLength(1);

      sub.unsubscribe();
      await flush();

      emitter.emit('job_event', {
        event: 'node.exited',
        data: {
          request_id: 'req-disconnect',
          type: 'node.exited',
          node: 'parse',
          status: 'success',
          duration_ms: 500,
          summary: 'Done',
          timestamp: t0,
        },
      });
      await flush();

      expect(received).toHaveLength(1);
    });
  });
});
