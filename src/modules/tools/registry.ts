import { Injectable, Logger, OnModuleInit, Optional, Inject } from '@nestjs/common';
import { performance } from 'perf_hooks';
import { z } from 'zod';
import * as SYS_MSG from '@constants/system-messages';
import { ToolContract } from './interfaces/tool-contract.interface';
import { ToolStatus, ToolTier } from './enums/tools.enums';
import { DuplicateToolError, ReservedToolNameError } from './errors/tools.errors';
import { ToolCallsActions, ToolCallLogParams } from './actions/tool-calls.actions';

/* -----------------------------------------------------------------
 *  Reserved identifiers that must never be used as a tool name.
 * ----------------------------------------------------------------- */
const RESERVED_NAMES = new Set(['price', 'policy', 'score']);

/**
 * Optional data‑scrubbing hook.  It is provided by the app (via the
 * `TOOL_SANITIZER` token) and should return a copy of the object with
 * any PII redacted.  If not supplied, data is logged unchanged.
 */
type Sanitizer = (data: unknown) => unknown;

/**
 * Centralised registry that validates, executes and logs every tool call.
 * It is a NestJS `@Injectable()` provider and therefore a singleton.
 */
@Injectable()
export class ToolRegistry implements OnModuleInit {
  private readonly logger = new Logger(ToolRegistry.name);
  private readonly registry = new Map<string, ToolContract<z.ZodTypeAny, z.ZodTypeAny>>();
  private readonly sanitizer?: Sanitizer;

  constructor(
    private readonly callsActions: ToolCallsActions,
    @Optional()
    @Inject('TOOL_SANITIZER')
    sanitizer?: Sanitizer,
  ) {
    this.sanitizer = sanitizer;
  }

  /** Lifecycle hook – just logs that the provider started */
  onModuleInit() {
    this.logger.log('ToolRegistry initialized');
  }

  /* -----------------------------------------------------------------
   *  Registration
   * ----------------------------------------------------------------- */
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

    // Freeze the contract – after registration nothing may be mutated.
    Object.freeze(contract);
    this.registry.set(name, contract);
    this.logger.verbose(`Registered tool "${name}"`);
  }

  /* -----------------------------------------------------------------
   *  Invocation
   * ----------------------------------------------------------------- */
  async invoke<O extends z.ZodTypeAny>(
    toolName: string,
    rawArgs: unknown,
    requestId?: string,
  ): Promise<{
    status: ToolStatus;
    latency: number;
    result?: z.infer<O>;
    error?: string;
  }> {
    const start = performance.now();
    const name = toolName.toLowerCase();

    // ---------------------------------------------------------------
    // 1️⃣ look up contract
    // ---------------------------------------------------------------
    const contract = this.registry.get(name);
    if (!contract) {
      const latency = Math.round(performance.now() - start);
      await this.log({
        toolName: name,
        status: ToolStatus.ERROR,
        latencyMs: latency,
        input: this.sanitize(rawArgs),
        tier: ToolTier.INTERNAL,
        errorMessage: SYS_MSG.TOOL_NOT_FOUND(name),
        requestId,
      });
      return { status: ToolStatus.ERROR, latency, error: SYS_MSG.TOOL_NOT_FOUND(name) };
    }

    // ---------------------------------------------------------------
    // 2️⃣ input validation
    // ---------------------------------------------------------------
    const inputParse = contract.inputSchema.safeParse(rawArgs);
    if (!inputParse.success) {
      const latency = Math.round(performance.now() - start);
      await this.log({
        toolName: name,
        status: ToolStatus.VALIDATION_ERROR,
        latencyMs: latency,
        input: this.sanitize(rawArgs),
        tier: contract.tier,
        errorMessage: `${SYS_MSG.TOOL_INPUT_VALIDATION_FAILED}: ${inputParse.error.message}`,
        requestId,
      });
      return {
        status: ToolStatus.VALIDATION_ERROR,
        latency,
        error: SYS_MSG.TOOL_INPUT_VALIDATION_FAILED,
      };
    }

    // ---------------------------------------------------------------
    // 3️⃣ execution with timeout handling
    // ---------------------------------------------------------------
    const timeoutMs = contract.timeout ?? 30_000;
    const abortCtrl = new AbortController();

    const execPromise = (async () => {
      try {
        const result = await contract.execute(inputParse.data, abortCtrl.signal);
        return { ok: true as const, value: result };
      } catch (e) {
        return { ok: false as const, error: e };
      }
    })();

    const timeoutPromise = new Promise<never>((_, reject) => {
      const id = setTimeout(() => {
        abortCtrl.abort();
        reject(new Error('Execution timed out'));
      }, timeoutMs);
      // clear timer if exec finishes first
      execPromise.finally(() => clearTimeout(id));
    });

    let execResult: { ok: true; value: unknown } | { ok: false; error: unknown };
    try {
      execResult = await Promise.race([execPromise, timeoutPromise]);
    } catch {
      // Timeout branch
      const latency = Math.round(performance.now() - start);
      await this.log({
        toolName: name,
        status: ToolStatus.TIMEOUT,
        latencyMs: latency,
        input: this.sanitize(rawArgs),
        tier: contract.tier,
        errorMessage: SYS_MSG.TOOL_EXECUTION_TIMEOUT,
        requestId,
      });
      return { status: ToolStatus.TIMEOUT, latency, error: SYS_MSG.TOOL_EXECUTION_TIMEOUT };
    }

    // ---------------------------------------------------------------
    // 4️⃣ post‑execution handling
    // ---------------------------------------------------------------
    const latency = Math.round(performance.now() - start);

    if (!execResult.ok) {
      const msg =
        execResult.error instanceof Error ? execResult.error.message : String(execResult.error);
      await this.log({
        toolName: name,
        status: ToolStatus.ERROR,
        latencyMs: latency,
        input: this.sanitize(rawArgs),
        tier: contract.tier,
        errorMessage: msg,
        requestId,
      });
      return { status: ToolStatus.ERROR, latency, error: msg };
    }

    // Validate output
    const outputParse = contract.outputSchema.safeParse(execResult.value);
    if (!outputParse.success) {
      await this.log({
        toolName: name,
        status: ToolStatus.VALIDATION_ERROR,
        latencyMs: latency,
        input: this.sanitize(rawArgs),
        output: this.sanitize(execResult.value),
        tier: contract.tier,
        errorMessage: `${SYS_MSG.TOOL_OUTPUT_VALIDATION_FAILED}: ${outputParse.error.message}`,
        requestId,
      });
      return {
        status: ToolStatus.VALIDATION_ERROR,
        latency,
        error: SYS_MSG.TOOL_OUTPUT_VALIDATION_FAILED,
      };
    }

    // Successful path – scrub only persisted log payloads
    const safeInput = this.sanitize(rawArgs);
    const safeOutput = this.sanitize(outputParse.data);

    await this.log({
      toolName: name,
      status: ToolStatus.OK,
      latencyMs: latency,
      input: safeInput,
      output: safeOutput,
      tier: contract.tier,
      requestId,
    });

    return { status: ToolStatus.OK, latency, result: outputParse.data };
  }

  /* -----------------------------------------------------------------
   *  Private helpers
   * ----------------------------------------------------------------- */

  /** Optionally scrub PII from log data before persisting. */
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

  /** Inserts a row into `tool_calls`. */
  private async log(params: ToolCallLogParams): Promise<void> {
    await this.callsActions.insertLog(params);
  }
}
