import { Injectable, Logger, MessageEvent } from '@nestjs/common';
import { Observable, filter, map, share } from 'rxjs';
import * as SYS_MSG from '../../../constants/system-messages';
import { SseService } from '../../../sse/sse.service';
import { EventsService } from '../../events/events.service';
import { StreamNode } from '../enums/stream-node.enum';
import { StreamToolStatus } from '../enums/stream-tool-status.enum';
import { NodeExitStatus } from '../enums/node-exit-status.enum';

const REASONING_PATTERNS = [
  /\b(chain\.of\.thought|CoT|reasoning|think step by step)\b/i,
  /\b(Let me think|I need to|First, I|We can see that)\b/i,
  /\b(assistant:|model:|AI:|system:)\s*$/im,
  /\b(step \d+\/\d+|step \d+ of \d+)\b/i,
];

function sanitizeSummary(summary: string): string {
  for (const pattern of REASONING_PATTERNS) {
    if (pattern.test(summary)) {
      return SYS_MSG.SANITIZED_SUMMARY_PLACEHOLDER;
    }
  }
  return summary;
}

function getTimestamp(): string {
  return new Date().toISOString();
}

@Injectable()
export class StreamService {
  private readonly logger = new Logger(StreamService.name);

  constructor(
    private readonly events: EventsService,
    private readonly sse: SseService,
  ) {}

  emitNodeEntered(requestId: string, node: StreamNode, orgId?: string): void {
    this.events
      .emit({
        eventName: 'node.entered',
        orgId,
        requestId,
        attributes: {
          type: 'node.entered',
          timestamp: getTimestamp(),
          node,
          status: 'processing',
        },
      })
      .catch((err: Error) => {
        this.logger.error({
          event: 'emit_node_entered_failed',
          error: err.message,
          requestId,
          node,
        });
      });
  }

  emitNodeExited(
    requestId: string,
    node: StreamNode,
    status: NodeExitStatus,
    durationMs: number,
    summary: string,
    orgId?: string,
  ): void {
    const safeSummary = sanitizeSummary(summary);
    this.events
      .emit({
        eventName: 'node.exited',
        orgId,
        requestId,
        attributes: {
          type: 'node.exited',
          timestamp: getTimestamp(),
          node,
          status,
          duration_ms: durationMs,
          summary: safeSummary,
        },
      })
      .catch((err: Error) => {
        this.logger.error({
          event: 'emit_node_exited_failed',
          error: err.message,
          requestId,
          node,
        });
      });
  }

  emitToolInvoked(
    requestId: string,
    node: StreamNode.EXTRACT | StreamNode.MATCH,
    toolName: string,
    status: StreamToolStatus,
    attempt: number,
    resultSummary: string,
    orgId?: string,
  ): void {
    const safeSummary = sanitizeSummary(resultSummary);
    this.events
      .emit({
        eventName: 'tool.invoked',
        orgId,
        requestId,
        attributes: {
          type: 'tool.invoked',
          timestamp: getTimestamp(),
          node,
          tool_name: toolName,
          status,
          attempt,
          result_summary: safeSummary,
        },
      })
      .catch((err: Error) => {
        this.logger.error({
          event: 'emit_tool_invoked_failed',
          error: err.message,
          requestId,
          node,
        });
      });
  }

  emitProcessingComplete(
    requestId: string,
    status: NodeExitStatus,
    totalDurationMs: number,
    orgId?: string,
  ): void {
    this.events
      .emit({
        eventName: 'processing.complete',
        orgId,
        requestId,
        attributes: {
          type: 'processing.complete',
          timestamp: getTimestamp(),
          status,
          total_duration_ms: totalDurationMs,
        },
      })
      .catch((err: Error) => {
        this.logger.error({
          event: 'emit_processing_complete_failed',
          error: err.message,
          requestId,
        });
      });
  }

  subscribe(requestId: string): Observable<MessageEvent> {
    return this.sse.stream().pipe(
      filter((event: MessageEvent) => {
        if (!event.data || typeof event.data !== 'object') return false;
        const data = event.data as Record<string, unknown>;
        return data.request_id === requestId;
      }),
      map((event: MessageEvent) => {
        const data = (event.data ?? {}) as Record<string, unknown>;
        return {
          ...event,
          data: this.sanitizeEvent(data),
        } as MessageEvent;
      }),
      share(),
    );
  }

  private sanitizeEvent(data: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === 'summary' || key === 'result_summary') {
        sanitized[key] = sanitizeSummary(String(value ?? ''));
      } else if (
        key === 'error' ||
        key === 'error_detail' ||
        key === 'raw_output' ||
        key === 'model_reasoning' ||
        key === 'chain_of_thought'
      ) {
        sanitized[key] = SYS_MSG.REDACTED_FIELD_PLACEHOLDER;
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map((item) => this.sanitizeValue(item));
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeEvent(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  private sanitizeValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeValue(item));
    }
    if (typeof value === 'object' && value !== null) {
      return this.sanitizeEvent(value as Record<string, unknown>);
    }
    return value;
  }
}
