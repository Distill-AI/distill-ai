import { Injectable, Logger, OnModuleInit, Optional, Inject } from '@nestjs/common';
import { performance } from 'perf_hooks';
import { z } from 'zod';
import { EventsService } from '@modules/events/events.service';
import * as SYS_MSG from '@constants/system-messages';
import { ToolContract } from './interfaces/tool-contract.interface';
import { ToolStatus } from './enums/tools.enums';
import { DuplicateToolError, ReservedToolNameError } from './errors/tools.errors';
import { ToolCallsActions, ToolCallLogParams } from './actions/tool-calls.actions';
import { ToolName, RESERVED_NAMES } from '../pipeline/types';

type Sanitizer = (data: unknown) => unknown;

const TOOL_NODE_MAP: Record<string, string> = {
  extract_request: 'extract',
  search_catalog: 'match',
};

function getTimestamp(): string {
  return new Date().toISOString();
}

function makeResultSummary(result: unknown): string {
  if (result === null || result === undefined) return 'Completed';
  if (typeof result === 'string') return result.length > 100 ? result.slice(0, 97) + '...' : result;
  if (typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    if (Array.isArray(obj)) return `Found ${obj.length} results`;
    if (obj.total !== undefined) return `Found ${obj.total} results`;
    if (obj.count !== undefined) return `Found ${obj.count} results`;
    if (obj.message && typeof obj.message === 'string') return obj.message;
    if (obj.summary && typeof obj.summary === 'string') return obj.summary;
    const keys = Object.keys(obj);
    return keys.length > 0 ? `Completed with ${keys.length} fields` : 'Completed';
  }
  return 'Completed';
}

@Injectable()
export class ToolRegistry implements OnModuleInit {
  private readonly logger = new Logger(ToolRegistry.name);
  private readonly registry = new Map<string, ToolContract<z.ZodTypeAny, z.ZodTypeAny>>();
  private readonly sanitizer?: Sanitizer;

  constructor(
    private readonly callsActions: ToolCallsActions,
    private readonly events: EventsService,
    @Optional()
    @Inject('TOOL_SANITIZER')
    sanitizer?: Sanitizer,
  ) {
    this.sanitizer = sanitizer;
  }

  onModuleInit() {
    this.logger.log('ToolRegistry initialized');
  }

  register<I extends z.ZodTypeAny, O extends z.ZodTypeAny>(contract: ToolContract<I, O>): void {
    const name = contract.toolName.toLowerCase();

    if (RESERVED_NAMES.has(name)) {
      throw new ReservedToolNameError(name);
    }
    if (this.registry.has(name)) {
      throw new DuplicateToolError(name);
    }
    if (!contract.execute || typeof contract.execute !== 'function') {
      throw new Error(`Invalid tool contract for "${name}": execute must be a function`);
    }

    Object.freeze(contract);
    this.registry.set(name, contract);
    this.logger.verbose(`Registered tool "${name}"`);
  }

  async invoke<O extends z.ZodTypeAny>(
    toolName: ToolName,
    rawArgs: unknown,
    requestId: string | null = null,
    attempt: number = 1,
  ): Promise<{
    status: ToolStatus;
    latency: number;
    result?: z.infer<O>;
    error?: string;
  }> {
    const start = performance.now();
    const name = toolName.toLowerCase();
    const rid = requestId ?? '00000000-0000-0000-0000-000000000000';
    const node = TOOL_NODE_MAP[name] ?? null;

    // Emit running status
    if (requestId && node) {
      await this.emitToolEvent(rid, node, name, 'running', attempt, 'Invoking tool');
    }

    // 1: look up contract
    const contract = this.registry.get(name);
    if (!contract) {
      const latency = Math.round(performance.now() - start);
      await this.log({
        toolName: name,
        status: ToolStatus.ERROR,
        latencyMs: latency,
        args: this.sanitize(rawArgs),
        errorDetail: SYS_MSG.TOOL_NOT_FOUND(name),
        requestId: rid,
      });
      if (requestId && node) {
        await this.emitToolEvent(rid, node, name, 'failed', attempt, 'Tool not found');
      }
      return { status: ToolStatus.ERROR, latency, error: SYS_MSG.TOOL_NOT_FOUND(name) };
    }

    // 2: input validation
    const inputParse = contract.inputSchema.safeParse(rawArgs);
    if (!inputParse.success) {
      const latency = Math.round(performance.now() - start);
      await this.log({
        toolName: name,
        status: ToolStatus.VALIDATION_ERROR,
        latencyMs: latency,
        args: this.sanitize(rawArgs),
        errorDetail: `${SYS_MSG.TOOL_INPUT_VALIDATION_FAILED}: ${inputParse.error.message}`,
        requestId: rid,
      });
      if (requestId && node) {
        await this.emitToolEvent(rid, node, name, 'failed', attempt, 'Input validation failed');
      }
      return {
        status: ToolStatus.VALIDATION_ERROR,
        latency,
        error: SYS_MSG.TOOL_INPUT_VALIDATION_FAILED,
      };
    }

    // 3: execution
    let execResult: { ok: true; value: unknown } | { ok: false; error: unknown };
    try {
      const result = await contract.execute(inputParse.data);
      execResult = { ok: true as const, value: result };
    } catch (e) {
      execResult = { ok: false as const, error: e };
    }

    const latency = Math.round(performance.now() - start);

    if (!execResult.ok) {
      const msg =
        execResult.error instanceof Error ? execResult.error.message : String(execResult.error);
      await this.log({
        toolName: name,
        status: ToolStatus.ERROR,
        latencyMs: latency,
        args: this.sanitize(rawArgs),
        errorDetail: msg,
        requestId: rid,
      });
      if (requestId && node) {
        await this.emitToolEvent(rid, node, name, 'failed', attempt, msg);
      }
      return { status: ToolStatus.ERROR, latency, error: msg };
    }

    // 4: output validation
    const outputParse = contract.outputSchema.safeParse(execResult.value);
    if (!outputParse.success) {
      await this.log({
        toolName: name,
        status: ToolStatus.VALIDATION_ERROR,
        latencyMs: latency,
        args: this.sanitize(rawArgs),
        errorDetail: `${SYS_MSG.TOOL_OUTPUT_VALIDATION_FAILED}: ${outputParse.error.message}`,
        requestId: rid,
      });
      if (requestId && node) {
        await this.emitToolEvent(rid, node, name, 'failed', attempt, 'Output validation failed');
      }
      return {
        status: ToolStatus.VALIDATION_ERROR,
        latency,
        error: SYS_MSG.TOOL_OUTPUT_VALIDATION_FAILED,
      };
    }

    // 5: success
    const safeArgs = this.sanitize(rawArgs);
    const resultSummary = makeResultSummary(outputParse.data);

    await this.log({
      toolName: name,
      status: ToolStatus.OK,
      latencyMs: latency,
      args: safeArgs,
      requestId: rid,
    });

    if (requestId && node) {
      await this.emitToolEvent(rid, node, name, 'success', attempt, resultSummary);
    } else if (requestId) {
      await this.events.emit({
        eventName: 'tool.invoked',
        requestId,
        attributes: {
          type: 'tool.invoked',
          timestamp: getTimestamp(),
          tool_name: name,
          status: 'success',
          attempt,
          result_summary: resultSummary,
        },
      });
    }

    return { status: ToolStatus.OK, latency, result: outputParse.data };
  }

  list(): Array<{ toolName: string; description: string }> {
    return Array.from(this.registry.values()).map((c) => ({
      toolName: c.toolName,
      description: c.description,
    }));
  }

  private async emitToolEvent(
    requestId: string,
    node: string,
    toolName: string,
    status: string,
    attempt: number,
    resultSummary: string,
  ): Promise<void> {
    await this.events.emit({
      eventName: 'tool.invoked',
      requestId,
      attributes: {
        type: 'tool.invoked',
        timestamp: getTimestamp(),
        node,
        tool_name: toolName,
        status,
        attempt,
        result_summary: resultSummary,
      },
    });
  }

  private sanitize(data: unknown): unknown {
    if (!this.sanitizer) return data;
    try {
      return this.sanitizer(data);
    } catch (err) {
      this.logger.warn(
        `Sanitizer failed; falling back to raw payload: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return data;
    }
  }

  private async log(params: ToolCallLogParams): Promise<void> {
    await this.callsActions.insertLog(params);
  }
}
