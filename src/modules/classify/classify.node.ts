import { Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { CurrentNode } from '@modules/requests/enums/current-node.enum';
import { RequestType } from '@modules/requests/enums/request-type.enum';
import { RequestModelAction } from '@modules/requests/requests.model-action';
import { EventsService } from '@modules/events/events.service';
import { NodeRegistry } from '@modules/pipeline/node-registry';
import { LineItem } from '@modules/catalog/entities/line-item.entity';
import type { PipelineNode, NodeContext, NodeResult } from '@modules/pipeline/types';
import { ClassifyService } from './services/classify.service';

@Injectable()
export class ClassifyNode implements PipelineNode {
  readonly name = CurrentNode.CLASSIFY;
  private readonly nextNode = CurrentNode.MATCH;
  private readonly logger = new Logger(ClassifyNode.name);

  constructor(
    registry: NodeRegistry,
    private readonly classifyService: ClassifyService,
    private readonly requests: RequestModelAction,
    private readonly events: EventsService,
    @InjectEntityManager() private readonly em: EntityManager,
  ) {
    registry.register(this);
  }

  async run(ctx: NodeContext): Promise<NodeResult> {
    const { requestId, orgId } = ctx;

    const req = await this.requests.get({
      identifierOptions: { id: requestId },
    });
    if (!req) {
      return { kind: 'failed', error: { message: `Request ${requestId} not found` } };
    }

    const lineItems = await this.em.find(LineItem, {
      where: { request_id: requestId },
      order: { position: 'ASC' },
    });

    const parsedRequest = {
      company: req.sender_company ?? '',
      contact: req.sender_contact ?? '',
      description: req.source_body ?? req.source_subject ?? '',
      lineItems,
    };

    const start = Date.now();
    const { type, confidence } = await this.classifyService.classify(parsedRequest);
    const elapsed = Date.now() - start;

    await this.requests.update({
      identifierOptions: { id: requestId },
      updatePayload: {
        request_type: type === 'catalog_rfq' ? RequestType.CATALOG_RFQ : RequestType.SERVICE_QUOTE,
        classification_confidence: confidence,
      },
      transactionOptions: { useTransaction: false },
    });

    try {
      await this.events.emit({
        eventName: 'node.exited',
        orgId,
        requestId,
        attributes: {
          node: this.name,
          next: this.nextNode,
          classification_type: type,
          classification_confidence: confidence,
          elapsed_ms: elapsed,
          message: `Classified as ${type} (confidence: ${(confidence * 100).toFixed(0)}%)`,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to emit node.exited event for request ${requestId}`, err);
      // Continue pipeline execution even if event emission fails
    }

    return { kind: 'advance', next: this.nextNode };
  }
}
