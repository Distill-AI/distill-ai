/* src/modules/tools/actions/tool-calls.actions.ts */
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ToolCallEntity } from '../entities/tool-calls.entity';
import { ToolCallStatus } from '../enums/tool-call-status.enum';
import { ToolTier } from '../enums/tool-tier.enum';

export interface ToolCallLogParams {
  toolName: string;
  status: ToolCallStatus;
  latencyMs: number;
  input: unknown;
  output?: unknown;
  errorMessage?: string;
  tier: ToolTier;
  requestId?: string;
}

/**
 * Thin wrapper around TypeORM – all DB operations are async and
 * never propagate errors to the caller (they are caught and logged).
 */
@Injectable()
export class ToolCallsActions {
  private readonly logger = new Logger(ToolCallsActions.name);

  constructor(private readonly dataSource: DataSource) {}

  async insertLog(params: ToolCallLogParams): Promise<void> {
    try {
      await this.dataSource
        .createQueryBuilder()
        .insert()
        .into(ToolCallEntity)
        .values({
          tool_name: params.toolName,
          status: params.status,
          latency_ms: params.latencyMs,
          input_args: params.input,
          output_result: params.output ?? null,
          error_message: params.errorMessage ?? null,
          tier: params.tier,
          request_id: params.requestId ?? null,
        } as Record<string, unknown>)
        .execute();
    } catch (err) {
      // Logging only – do NOT re‑throw, because the caller already has a result.
      this.logger.error(
        `Failed to insert tool_calls log for ${params.toolName}: ${err}`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  }
}
