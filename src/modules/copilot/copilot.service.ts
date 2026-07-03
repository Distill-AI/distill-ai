import { randomUUID } from 'crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import * as SYS_MSG from '@constants/system-messages';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import { LineItemModelAction } from '@modules/catalog/line-item.model-action';
import type { LineItem } from '@modules/catalog/entities/line-item.entity';
import { CLOSE_TIE_FLAG, MANUAL_OVERRIDE_FLAG } from '@modules/catalog/line-item-flags.constants';
import { RequestRouting } from '@modules/requests/enums/request-routing.enum';
import type { Request } from '@modules/requests/entities/request.entity';
import { ToolRegistry } from '@modules/tools/registry';
import { ToolStatus } from '@modules/tools/enums/tools.enums';
import { toToolName } from '@modules/pipeline/types';
import { RedisService } from '@modules/redis/redis.service';
import type { ExplainRoutingOutput } from '@modules/scoring/tools/explain-routing.tool';
import {
  COPILOT_EXPLANATION_CACHE_TTL_S,
  COPILOT_EXPLANATION_LOCK_TTL_S,
  copilotExplanationCacheKey,
  copilotExplanationLockKey,
} from './copilot.constants';

// Bounds how many times a caller that lost the stampede-protection lock polls the cache before
// giving up and computing anyway; 5 x 200ms is a short wait relative to typical LLM latency.
const LOCK_WAIT_ATTEMPTS = 5;
const LOCK_WAIT_INTERVAL_MS = 200;

@Injectable()
export class CopilotService {
  constructor(
    private readonly lineItems: LineItemModelAction,
    private readonly toolRegistry: ToolRegistry,
    private readonly redis: RedisService,
  ) {}

  /** Returns the advisory routing explanation for a request; short-circuits to empty for non-needs_review requests. */
  async getExplanation(request: Request): Promise<ExplainRoutingOutput> {
    if (request.routing !== RequestRouting.NEEDS_REVIEW) {
      return { explanation: '', degraded: false };
    }

    const cacheKey = copilotExplanationCacheKey(request.id);
    const cached = await this.readCache(cacheKey);
    if (cached) {
      return cached;
    }

    return this.computeWithStampedeProtection(request, cacheKey);
  }

  /**
   * Acquires a short-lived lock so a burst of concurrent requests for the same id doesn't each
   * pay for a separate LLM call. The loser polls the cache briefly rather than blocking
   * indefinitely, so a crashed or slow lock holder can never wedge every other caller.
   */
  private async computeWithStampedeProtection(
    request: Request,
    cacheKey: string,
  ): Promise<ExplainRoutingOutput> {
    const lockKey = copilotExplanationLockKey(request.id);
    const lockToken = randomUUID();
    const acquired = await this.redis.setNx(lockKey, lockToken, COPILOT_EXPLANATION_LOCK_TTL_S);

    if (!acquired) {
      const cached = await this.waitForCache(cacheKey);
      if (cached) {
        return cached;
      }
      return this.computeExplanation(request, cacheKey);
    }

    try {
      return await this.computeExplanation(request, cacheKey);
    } finally {
      await this.redis.releaseLock(lockKey, lockToken);
    }
  }

  private async waitForCache(cacheKey: string): Promise<ExplainRoutingOutput | null> {
    for (let attempt = 0; attempt < LOCK_WAIT_ATTEMPTS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, LOCK_WAIT_INTERVAL_MS));
      const cached = await this.readCache(cacheKey);
      if (cached) {
        return cached;
      }
    }
    return null;
  }

  private async computeExplanation(
    request: Request,
    cacheKey: string,
  ): Promise<ExplainRoutingOutput> {
    const policyFlags = await this.aggregatePolicyFlags(request.id);

    let result: Awaited<ReturnType<ToolRegistry['invoke']>>;
    try {
      result = await this.toolRegistry.invoke(
        toToolName('explain_routing'),
        {
          routing: request.routing,
          overallConfidence: request.overall_confidence ?? 0,
          routingReasons: request.routing_reasons,
          policyFlags,
        },
        request.id,
      );
    } catch {
      throw new CustomHttpException(
        SYS_MSG.COPILOT_EXPLANATION_GENERATION_FAILED,
        HttpStatus.FAILED_DEPENDENCY,
      );
    }

    if (result.status !== ToolStatus.OK) {
      throw new CustomHttpException(
        SYS_MSG.COPILOT_EXPLANATION_GENERATION_FAILED,
        HttpStatus.FAILED_DEPENDENCY,
      );
    }

    const explanation = result.result as ExplainRoutingOutput;
    await this.redis.set(cacheKey, JSON.stringify(explanation), COPILOT_EXPLANATION_CACHE_TTL_S);
    return explanation;
  }

  private async readCache(cacheKey: string): Promise<ExplainRoutingOutput | null> {
    const cached = await this.redis.get(cacheKey);
    if (!cached) {
      return null;
    }
    try {
      return JSON.parse(cached) as ExplainRoutingOutput;
    } catch {
      return null;
    }
  }

  private async aggregatePolicyFlags(requestId: string): Promise<string[]> {
    const lineRows = await this.lineItems.list({
      filterRecordOptions: { request_id: requestId },
    });

    const flags = new Set<string>();
    for (const line of lineRows.payload as LineItem[]) {
      if (!Array.isArray(line.flags)) continue;
      for (const flag of line.flags as string[]) {
        if (flag === CLOSE_TIE_FLAG || flag === MANUAL_OVERRIDE_FLAG) continue;
        flags.add(flag);
      }
    }

    return [...flags];
  }
}
