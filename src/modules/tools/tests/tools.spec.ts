import { ToolRegistry } from '../registry';
import { ToolStatus } from '../enums/tools.enums';
import { DuplicateToolError } from '../errors/tools.errors';
import { ReservedToolNameError } from '../errors/tools.errors';
import { EchoTool } from '../tools/echo-tool';
import { ToolCallsActions } from '../actions/tool-calls.actions';
import { z } from 'zod';
import { ToolContract } from '../interfaces/tool-contract.interface';
import { EventsService } from '../../events/events.service';
import { ToolName } from '../../pipeline/types';

function createMockActions(): ToolCallsActions {
  return {
    insertLog: vi.fn().mockResolvedValue(undefined),
  } as unknown as ToolCallsActions;
}

function createMockEvents(): EventsService {
  return {
    emit: vi.fn().mockResolvedValue(undefined),
  } as unknown as EventsService;
}

describe('ToolRegistry – Core / Integration', () => {
  let registry: ToolRegistry;
  let mockActions: ToolCallsActions;
  let mockEvents: EventsService;

  beforeEach(() => {
    mockActions = createMockActions();
    mockEvents = createMockEvents();
    registry = new ToolRegistry(mockActions, mockEvents);
    registry.register(EchoTool);
  });

  it('FR-1: invokes echo tool and returns correct result', async () => {
    const res = await registry.invoke('echo_tool' as ToolName, { message: 'hello' });
    expect(res.status).toBe(ToolStatus.OK);
    expect(res.result).toEqual({ echoed: 'hello' });
  });

  it('FR-2: rejects duplicate registration', () => {
    expect(() => registry.register(EchoTool)).toThrow(DuplicateToolError);
  });

  it('FR-3: rejects reserved tool names (case-insensitive)', () => {
    const bad = { ...EchoTool, toolName: 'Price' };
    expect(() => registry.register(bad)).toThrow(ReservedToolNameError);
  });

  it('FR-4: logs every invocation via insertLog', async () => {
    await registry.invoke('echo_tool' as ToolName, { message: 'integrate' });
    expect(mockActions.insertLog).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'echo_tool',
        status: ToolStatus.OK,
        args: { message: 'integrate' },
      }),
    );
  });

  it('FR-5: registers a custom tool and invokes it', async () => {
    const DoubleTool: ToolContract<z.ZodTypeAny, z.ZodTypeAny> = {
      toolName: 'double_tool',
      description: 'returns double the input',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ doubled: z.number() }),
      async execute(input) {
        return { doubled: input.value * 2 };
      },
    };
    registry.register(DoubleTool);
    const res = await registry.invoke('double_tool' as ToolName, { value: 21 });
    expect(res.status).toBe(ToolStatus.OK);
    expect(res.result).toEqual({ doubled: 42 });
  });

  it('FR-6: returns TOOL_NOT_FOUND error for unknown tool', async () => {
    const res = await registry.invoke('nonexistent' as ToolName, {});
    expect(res.status).toBe(ToolStatus.ERROR);
    expect(res.error).toContain('not registered');
  });

  describe('EC – Edge cases', () => {
    it('EC-1: handles null args as validation error', async () => {
      const res = await registry.invoke('echo_tool' as ToolName, null);
      expect(res.status).toBe(ToolStatus.VALIDATION_ERROR);
      expect(res.error).toBe('Input validation failed');
    });

    it('EC-2: gracefully rejects circular input without crashing', async () => {
      const circ: Record<string, unknown> = { a: 1 };
      circ.self = circ;
      const res = await registry.invoke('echo_tool' as ToolName, circ);
      expect(res.status).toBe(ToolStatus.VALIDATION_ERROR);
    });

    it('EC-3: returns huge output without truncation (up to Zod limit)', async () => {
      const BigTool: ToolContract<z.ZodTypeAny, z.ZodTypeAny> = {
        toolName: 'big_tool',
        description: 'returns >100 KB payload',
        inputSchema: z.object({}),
        outputSchema: z.object({ payload: z.string() }),
        async execute() {
          return { payload: 'x'.repeat(150_000) };
        },
      };
      registry.register(BigTool);
      const res = await registry.invoke('big_tool' as ToolName, {});
      expect(res.status).toBe(ToolStatus.OK);
      expect(res.result?.payload.length).toBeGreaterThanOrEqual(150_000);
    });

    it('EC-4: concurrent invocations each return correct results', async () => {
      const concurrency = 10;
      const promises = Array.from({ length: concurrency }, (_, i) =>
        registry.invoke('echo_tool' as ToolName, { message: `msg-${i}` }),
      );
      const results = await Promise.all(promises);
      results.forEach((r, i) => {
        expect(r.status).toBe(ToolStatus.OK);
        expect(r.result).toEqual({ echoed: `msg-${i}` });
      });
    });

    it('EC-5: handles tool with no execute function gracefully', async () => {
      const NoExecTool = {
        toolName: 'noexec_tool',
        description: 'missing execute',
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.boolean() }),
      } as unknown as ToolContract<z.ZodTypeAny, z.ZodTypeAny>;
      expect(() => registry.register(NoExecTool)).toThrow();
    });

    it('EC-6: validates output schema and returns error on mismatch', async () => {
      const BadOutputTool: ToolContract<z.ZodTypeAny, z.ZodTypeAny> = {
        toolName: 'bad_output',
        description: 'returns value that does not match schema',
        inputSchema: z.object({}),
        outputSchema: z.object({ expected: z.string() }),
        async execute() {
          return { unexpected: true };
        },
      };
      registry.register(BadOutputTool);
      const res = await registry.invoke('bad_output' as ToolName, {});
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
      registry = new ToolRegistry(mockActions, mockEvents, sanitizer);
      registry.register(EchoTool);

      const SensitiveTool: ToolContract<z.ZodTypeAny, z.ZodTypeAny> = {
        toolName: 'sensitive_tool',
        description: 'echoes whatever is sent',
        inputSchema: z.object({ user: z.string(), password: z.string() }),
        outputSchema: z.object({ user: z.string(), password: z.string() }),
        async execute(input) {
          return input;
        },
      };
      registry.register(SensitiveTool);

      const payload = { user: 'alice', password: 'SuperSecret123' };
      const res = await registry.invoke('sensitive_tool' as ToolName, payload);
      expect(res.status).toBe(ToolStatus.OK);

      expect(mockActions.insertLog).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: 'sensitive_tool',
          args: { user: 'alice', password: '***' },
        }),
      );
    });

    it('SEC-2: rejects reserved names as registration', () => {
      const reserved = ['price', 'policy', 'score'];
      for (const name of reserved) {
        const tool = { ...EchoTool, toolName: name };
        expect(() => registry.register(tool)).toThrow();
      }
    });
  });
});
