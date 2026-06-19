import { ToolRegistry } from '../registry';
import { ToolStatus } from '../enums/tool-call-status.enum';
import { ToolTier } from '../enums/tool-tier.enum';
import { ToolContract } from '../interfaces/tool-contract.interface';
import { EchoTool } from '../tools/echo-tool';
import { ToolCallsActions } from '../actions/tool-calls.actions';
import { z } from 'zod';

function createMockActions(): ToolCallsActions {
  return {
    insertLog: vi.fn().mockResolvedValue(undefined),
  } as unknown as ToolCallsActions;
}

describe('ToolRegistry – Edge Cases / Security', () => {
  let registry: ToolRegistry;
  let mockActions: ToolCallsActions;

  beforeEach(() => {
    mockActions = createMockActions();
    registry = new ToolRegistry(mockActions);
    registry.register(EchoTool);
  });

  describe('EC – Edge cases', () => {
    it('EC-1: handles null args as validation error', async () => {
      const res = await registry.invoke('echo_tool', null);
      expect(res.status).toBe(ToolStatus.VALIDATION_ERROR);
      expect(res.error).toBe('Input validation failed');
    });

    it('EC-2: gracefully rejects circular input without crashing', async () => {
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
      registry.register(BigTool);
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
      registry.register(SlowTool);
      const res = await registry.invoke('slow_tool', { ms: 500 });
      expect(res.status).toBe(ToolStatus.TIMEOUT);
      expect(res.error).toBe('Execution timed out');
    });

    it('EC-6: handles tool with no execute function gracefully', async () => {
      const NoExecTool = {
        toolName: 'noexec_tool',
        description: 'missing execute',
        tier: ToolTier.INTERNAL,
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.boolean() }),
      } as ToolContract<z.ZodTypeAny, z.ZodTypeAny>;
      expect(() => registry.register(NoExecTool)).toThrow();
    });

    it('EC-7: validates output schema and returns error on mismatch', async () => {
      const BadOutputTool: ToolContract<z.ZodTypeAny, z.ZodTypeAny> = {
        toolName: 'bad_output',
        description: 'returns value that does not match schema',
        tier: ToolTier.INTERNAL,
        inputSchema: z.object({}),
        outputSchema: z.object({ expected: z.string() }),
        async execute() {
          return { unexpected: true };
        },
      };
      registry.register(BadOutputTool);
      const res = await registry.invoke('bad_output', {});
      expect(res.status).toBe(ToolStatus.VALIDATION_ERROR);
      expect(res.error).toBe('Output validation failed');
    });
  });

  describe('SEC – Security / Sanitisation', () => {
    it('SEC-1: redacts password fields before persisting', async () => {
      const sanitizer = (data: unknown) => {
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
      };
      registry = new ToolRegistry(mockActions, sanitizer);
      registry.register(EchoTool);

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
      registry.register(SensitiveTool);

      const payload = { user: 'alice', password: 'SuperSecret123' };
      const res = await registry.invoke('sensitive_tool', payload);
      expect(res.status).toBe(ToolStatus.OK);

      expect(mockActions.insertLog).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: 'sensitive_tool',
          input: { user: 'alice', password: '***' },
          output: { user: 'alice', password: '***' },
        }),
      );
    });

    it('SEC-2: rejects reserved names from ToolName enum as registration', () => {
      const reserved = ['price', 'policy', 'score'];
      for (const name of reserved) {
        const tool = { ...EchoTool, toolName: name };
        expect(() => registry.register(tool)).toThrow();
      }
    });
  });
});
