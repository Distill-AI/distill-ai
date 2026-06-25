import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CurrentNode } from '@modules/requests/enums/current-node.enum';
import { NodeRegistry } from '@modules/pipeline/node-registry';
import { ToolRegistry } from '@modules/tools/registry';
import { toToolName } from '@modules/pipeline/types';
import type { NodeContext, NodeResult, PipelineNode } from '@modules/pipeline/types';
import { EventsService } from '@modules/events/events.service';
import { CandidateMatchModelAction } from './candidate-match.model-action';
import { MatchMethod } from './enums/match-method.enum';
import { LineItem } from './entities/line-item.entity';
import type {
  SearchCatalogCandidate,
  SearchCatalogResult,
} from './interfaces/search-catalog.interfaces';
import { env } from '@config/env';
import * as SYS_MSG from '@constants/system-messages';

@Injectable()
export class MatchNode implements PipelineNode {
  readonly name = CurrentNode.MATCH;
  private readonly nextNode = CurrentNode.PRICE;
  private readonly logger = new Logger(MatchNode.name);

  constructor(
    registry: NodeRegistry,
    private readonly tools: ToolRegistry,
    private readonly candidateActions: CandidateMatchModelAction,
    private readonly events: EventsService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    registry.register(this);
  }

  async run(ctx: NodeContext): Promise<NodeResult> {
    const { requestId, orgId } = ctx;

    const lineItems = await this.dataSource.manager.find(LineItem, {
      where: { request_id: requestId },
      order: { position: 'ASC' },
    });

    if (lineItems.length === 0) {
      await this.emitExited(orgId, requestId, { matched: 0, total: 0, degraded: false });
      return { kind: 'advance', next: this.nextNode };
    }

    const allMatched = lineItems.every((item) => item.matched_sku_id !== null);
    if (allMatched) {
      await this.emitExited(orgId, requestId, {
        matched: lineItems.length,
        total: lineItems.length,
        degraded: false,
      });
      return { kind: 'advance', next: this.nextNode };
    }

    let matchedCount = 0;
    let anyDegraded = false;

    for (const item of lineItems) {
      if (item.matched_sku_id !== null) {
        matchedCount++;
        continue;
      }

      const trimmed = item.raw_text.trim();
      if (trimmed === '' || trimmed.toUpperCase() === 'UNKNOWN') {
        this.logger.warn({
          event: 'match_skipped',
          itemId: item.id,
          reason: SYS_MSG.MATCH_SKIPPED_EMPTY,
        });
        continue;
      }

      const invocation = await this.tools.invoke(
        toToolName('search_catalog'),
        { query: trimmed, orgId, limit: 5 },
        requestId,
        1,
        orgId,
      );

      if (invocation.status !== 'ok' || !invocation.result) {
        this.logger.warn({
          event: 'search_catalog_failed',
          itemId: item.id,
          status: invocation.status,
        });
        continue;
      }

      const { candidates, degraded } = invocation.result as SearchCatalogResult;
      if (degraded) anyDegraded = true;

      const candidateRows = candidates.map((c: SearchCatalogCandidate) => ({
        sku_id: c.sku_id,
        score: c.score,
        rank: c.rank,
      }));

      if (candidates.length === 0) {
        await this.dataSource.transaction((em) =>
          this.candidateActions.replaceForLineItem(item.id, candidateRows, em),
        );
        continue;
      }

      const best = candidates[0];

      let method = best.match_method;
      if (
        best.score >= env.AUTO_THRESHOLD &&
        (method === MatchMethod.FUZZY || method === MatchMethod.FUSED)
      ) {
        method = MatchMethod.EXACT;
      }

      const isCloseTie =
        candidates[1] !== undefined && candidates[1].score >= best.score - env.CLOSE_TIE_MARGIN;

      const existingFlags = Array.isArray(item.flags) ? (item.flags as string[]) : [];
      const flags: string[] = isCloseTie ? [...existingFlags, 'close_tie'] : existingFlags;

      await this.dataSource.transaction(async (em) => {
        await this.candidateActions.replaceForLineItem(item.id, candidateRows, em);
        await em.update(
          LineItem,
          { id: item.id },
          {
            matched_sku_id: best.sku_id,
            match_confidence: best.score,
            match_method: method,
            flags: flags as unknown as object[],
          },
        );
      });

      matchedCount++;
    }

    await this.emitExited(orgId, requestId, {
      matched: matchedCount,
      total: lineItems.length,
      degraded: anyDegraded,
    });

    return { kind: 'advance', next: this.nextNode };
  }

  private async emitExited(
    orgId: string,
    requestId: string,
    attrs: { matched: number; total: number; degraded: boolean },
  ): Promise<void> {
    try {
      await this.events.emit({
        eventName: 'node.exited',
        orgId,
        requestId,
        attributes: {
          node: this.name,
          next: this.nextNode,
          matched_count: attrs.matched,
          total_count: attrs.total,
          degraded: attrs.degraded,
          message: attrs.degraded
            ? SYS_MSG.MATCH_DEGRADED
            : SYS_MSG.MATCH_COMPLETE(attrs.matched, attrs.total),
        },
      });
    } catch (err) {
      this.logger.error(`Failed to emit node.exited for request ${requestId}`, err);
    }
  }
}
