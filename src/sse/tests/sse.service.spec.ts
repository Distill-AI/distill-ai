import { EventEmitter2 } from '@nestjs/event-emitter';
import { SseService } from '../sse.service';

function makeService() {
  const emitter = new EventEmitter2();
  const service = new SseService(emitter);
  return { service, emitter };
}

describe('SseService', () => {
  describe('emit()', () => {
    it('publishes to the job_event channel with event name and data', () => {
      const { service, emitter } = makeService();

      return new Promise<void>((resolve) => {
        emitter.once('job_event', (payload: unknown) => {
          expect(payload).toEqual({
            event: 'job_created',
            data: { id: 'abc', status: 'pending' },
          });
          resolve();
        });

        service.emit('job_created', { id: 'abc', status: 'pending' });
      });
    });
  });

  describe('stream()', () => {
    it('emits a MessageEvent for each published event', async () => {
      const { service } = makeService();
      const received: unknown[] = [];

      await new Promise<void>((resolve) => {
        const sub = service.stream().subscribe((msg) => {
          received.push(msg);
          if (received.length === 2) {
            sub.unsubscribe();
            resolve();
          }
        });

        service.emit('job_started', { id: '1', status: 'processing' });
        service.emit('job_completed', { id: '1', status: 'completed' });
      });

      expect(received).toEqual([
        { type: 'job_started', data: { id: '1', status: 'processing' } },
        { type: 'job_completed', data: { id: '1', status: 'completed' } },
      ]);
    });

    it('removes the listener when the subscriber unsubscribes', () => {
      const { service, emitter } = makeService();

      const sub = service.stream().subscribe(() => {});
      expect(emitter.listenerCount('job_event')).toBe(1);

      sub.unsubscribe();
      expect(emitter.listenerCount('job_event')).toBe(0);
    });

    it('multiple subscribers each receive the same event independently', async () => {
      const { service } = makeService();
      const results: string[] = [];

      const sub1 = service.stream().subscribe((msg) => results.push(`A:${msg.type}`));
      const sub2 = service.stream().subscribe((msg) => results.push(`B:${msg.type}`));

      service.emit('job_failed', { id: '2', status: 'failed', error: 'timeout' });

      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(results).toEqual(expect.arrayContaining(['A:job_failed', 'B:job_failed']));
      sub1.unsubscribe();
      sub2.unsubscribe();
    });
  });
});
