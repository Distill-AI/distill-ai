import { Test, TestingModule } from '@nestjs/testing';
import { ToolsModule } from '../tools.module';
import { ToolRegistry } from '../registry';
import { ToolStatus } from '../enums/tool-call-status.enum';
import { ToolTier } from '../enums/tool-tier.enum';
import { ToolContract } from '../interfaces/tool-contract.interface';
import { DuplicateToolError } from '../errors/duplicate-tool.error';
import { DataSource } from 'typeorm';
import { ToolCallEntity } from '../entities/tool-calls.entity';
import { z } from 'zod';

describe('ToolRegistry – Edge Cases / Security', () => {
  let registry: ToolRegistry;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ToolsModule],
      providers: [
        {
          provide: 'TOOL_SANITIZER',
          useValue: (data: unknown) => {
            if (typeof data !== 'object' || data === null) return data;
            const clone: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
              if (['password', 'secret'].includes(k.toLowerCase())) {
                clone[k] = '***';
              } else {
                clone[k] = v;
              }
            }
            return clone;
          },
        },
      ],
    }).compile();
    registry = moduleRef.get<ToolRegistry>(ToolRegistry);
  });

  afterAll(async () => {
    const ds = moduleRef.get<DataSource>(DataSource);
    await ds.destroy();
  });

  describe('EC – Edge cases', () => {
    it('EC-1: handles null args as validation error (no execute)', async () => {
      const res = await registry.invoke('echo_tool', null);
      expect(res.status).toBe(ToolStatus.VALIDATION_ERROR);
      expect(res.error).toBe('Input validation failed');
    });

    it('EC-2: gracefully logs circular input without crashing', async () => {
      const circ: Record<string, unknown> = { a: 1 };
      circ.self = circ;
      const res = await registry.invoke('echo_tool', circ);
      expect(res.status).toBe(ToolStatus.VALIDATION_ERROR);
    });

    it('EC-3: returns huge output without truncation (up to Zod limit)', async () => {
      const BigTool: ToolContract<z.ZodTypeAny, z.ZodTypeAny> = {
        toolName: 'big_tool',
        description: 'returns >100 KB payload',
        tier: ToolTier.INTERNAL,
        inputSchema: z.object({}),
        outputSchema: z.object({ payload: z.string() }),
        async execute() {
          return { payload: 'x'.repeat(150_000) };
        },
      };
      try {
        registry.register(BigTool);
      } catch (e) {
        if (!(e instanceof DuplicateToolError)) throw e;
      }
      const res = await registry.invoke('big_tool', {});
      expect(res.status).toBe(ToolStatus.OK);
      expect(res.result?.payload.length).toBeGreaterThanOrEqual(150_000);
    });

    it('EC-4: concurrent invocations each return correct results', async () => {
      const concurrency = 10;
      const promises = Array.from({ length: concurrency }, (_, i) =>
        registry.invoke('echo_tool', { message: `msg-${i}` }),
      );
      const results = await Promise.all(promises);
      results.forEach((r, i) => {
        expect(r.status).toBe(ToolStatus.OK);
        expect(r.result).toEqual({ echoed: `msg-${i}` });
      });
    });

    it('EC-5: timeouts are recorded when tool exceeds its limit', async () => {
      const SlowTool: ToolContract<z.ZodTypeAny, z.ZodTypeAny> = {
        toolName: 'slow_tool',
        description: 'sleeps longer than timeout',
        tier: ToolTier.INTERNAL,
        timeout: 200,
        inputSchema: z.object({ ms: z.number() }),
        outputSchema: z.object({ finished: z.boolean() }),
        async execute(input, abortSignal) {
          const sleep = (ms: number) =>
            new Promise<void>((resolve, reject) => {
              const timer = setTimeout(() => resolve(), ms);
              abortSignal?.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(new Error('Aborted'));
              });
            });
          await sleep(input.ms);
          return { finished: true };
        },
      };
      try {
        registry.register(SlowTool);
      } catch (e) {
        if (!(e instanceof DuplicateToolError)) throw e;
      }
      const res = await registry.invoke('slow_tool', { ms: 500 });
      expect(res.status).toBe(ToolStatus.TIMEOUT);
      expect(res.error).toBe('Execution timed out');
    });
  });

  describe('SEC – Security / Sanitisation', () => {
    it('SEC-1: redacts password fields before persisting', async () => {
      const SensitiveTool: ToolContract<z.ZodTypeAny, z.ZodTypeAny> = {
        toolName: 'sensitive_tool',
        description: 'echoes whatever is sent',
        tier: ToolTier.INTERNAL,
        inputSchema: z.object({ user: z.string(), password: z.string() }),
        outputSchema: z.object({ user: z.string(), password: z.string() }),
        async execute(input) {
          return input;
        },
      };
      try {
        registry.register(SensitiveTool);
      } catch (e) {
        if (!(e instanceof DuplicateToolError)) throw e;
      }

      const payload = { user: 'alice', password: 'SuperSecret123' };
      const res = await registry.invoke('sensitive_tool', payload);
      expect(res.status).toBe(ToolStatus.OK);
      expect(res.result).toEqual(payload);

      const ds = moduleRef.get<DataSource>(DataSource);
      const repo = ds.getRepository(ToolCallEntity);
      const row = await repo.findOne({
        where: { tool_name: 'sensitive_tool' },
        order: { created_at: 'DESC' },
      });
      expect(row!.input_args).toEqual({ user: 'alice', password: '***' });
      expect(row!.output_result).toEqual({ user: 'alice', password: '***' });
    });
  });
});
