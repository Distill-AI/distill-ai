import { Test, TestingModule } from '@nestjs/testing';
import { ToolsModule } from '../tools.module';
import { ToolRegistry } from '../registry';
import { ToolStatus } from '../enums/tool-call-status.enum';
import { ToolCallEntity } from '../entities/tool-calls.entity';
import { DuplicateToolError } from '../errors/duplicate-tool.error';
import { ReservedToolNameError } from '../errors/reserved-tool.error';
import { EchoTool } from '../tools/echo-tool';
import { DataSource } from 'typeorm';

describe('ToolRegistry – Core / Integration', () => {
  let registry: ToolRegistry;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ToolsModule],
    }).compile();
    registry = moduleRef.get<ToolRegistry>(ToolRegistry);
  });

  afterAll(async () => {
    const ds = moduleRef.get<DataSource>(DataSource);
    await ds.destroy();
  });

  it('FR-1: registers built-in echo tool on module init', async () => {
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

  it('FR-4: writes a row that can be queried directly', async () => {
    const start = Date.now();
    const res = await registry.invoke('echo_tool', { message: 'integrate' });
    const end = Date.now();

    expect(res.status).toBe(ToolStatus.OK);
    expect(res.result).toEqual({ echoed: 'integrate' });

    const ds = moduleRef.get<DataSource>(DataSource);
    const row = await ds
      .getRepository(ToolCallEntity)
      .findOne({ where: { tool_name: 'echo_tool' }, order: { created_at: 'DESC' } });

    expect(row).toBeDefined();
    expect(row!.tool_name).toBe('echo_tool');
    expect(row!.status).toBe(ToolStatus.OK);
    expect(row!.latency_ms).toBeGreaterThanOrEqual(end - start);
    expect(row!.input_args).toEqual({ message: 'integrate' });
    expect(row!.output_result).toEqual({ echoed: 'integrate' });
    expect(row!.tier).toBe('free');
  });
});
