import { ToolRegistry } from '../registry';
import { ToolStatus } from '../enums/tool-call-status.enum';
import { ToolTier } from '../enums/tool-tier.enum';
import { DuplicateToolError } from '../errors/duplicate-tool.error';
import { ReservedToolNameError } from '../errors/reserved-tool.error';
import { EchoTool } from '../tools/echo-tool';
import { ToolCallsActions } from '../actions/tool-calls.actions';
import { z } from 'zod';
import { ToolContract } from '../interfaces/tool-contract.interface';

function createMockActions(): ToolCallsActions {
  return {
    insertLog: vi.fn().mockResolvedValue(undefined),
  } as unknown as ToolCallsActions;
}

describe('ToolRegistry – Core / Integration', () => {
  let registry: ToolRegistry;
  let mockActions: ToolCallsActions;

  beforeEach(() => {
    mockActions = createMockActions();
    registry = new ToolRegistry(mockActions);
    registry.register(EchoTool);
  });

  it('FR-1: invokes echo tool and returns correct result', async () => {
    const res = await registry.invoke('echo_tool', { message: 'hello' });
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
    await registry.invoke('echo_tool', { message: 'integrate' });
    expect(mockActions.insertLog).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'echo_tool',
        status: ToolStatus.OK,
        input: { message: 'integrate' },
        output: { echoed: 'integrate' },
      }),
    );
  });

  it('FR-5: registers a custom tool and invokes it', async () => {
    const DoubleTool: ToolContract<z.ZodTypeAny, z.ZodTypeAny> = {
      toolName: 'double_tool',
      description: 'returns double the input',
      tier: ToolTier.FREE,
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ doubled: z.number() }),
      async execute(input) {
        return { doubled: input.value * 2 };
      },
    };
    registry.register(DoubleTool);
    const res = await registry.invoke('double_tool', { value: 21 });
    expect(res.status).toBe(ToolStatus.OK);
    expect(res.result).toEqual({ doubled: 42 });
  });

  it('FR-6: returns TOOL_NOT_FOUND error for unknown tool', async () => {
    const res = await registry.invoke('nonexistent', {});
    expect(res.status).toBe(ToolStatus.ERROR);
    expect(res.error).toContain('not found');
  });
});
