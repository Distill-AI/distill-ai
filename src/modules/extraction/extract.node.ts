import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as SYS_MSG from '@constants/system-messages';
import { CurrentNode } from '@modules/requests/enums/current-node.enum';
import { RequestModelAction } from '@modules/requests/requests.model-action';
import { AttachmentModelAction } from '@modules/requests/attachments.model-action';
import { LineItemModelAction } from '@modules/catalog/line-item.model-action';
import { ToolRegistry } from '@modules/tools/registry';
import { ToolStatus } from '@modules/tools/enums/tools.enums';
import { EventsService } from '@modules/events/events.service';
import { NodeRegistry } from '@modules/pipeline/node-registry';
import { toToolName } from '@modules/pipeline/types';
import type { NodeContext, NodeResult, PipelineNode } from '@modules/pipeline/types';
import { EXTRACTION_FAILURE_EMPTY_SOURCE } from './constants';
import { ExtractionModelAction } from './extraction.model-action';
import { ExtractionStatus } from './enums/extraction-status.enum';
import { extractionModelName } from './tools/extract-request.tool';
import { reconcile } from './reconcile';
import type { ExtractionV1 } from './schemas/extraction-v1.schema';
import { ExtractionV1Schema, formatSchemaError } from './schemas/extraction-v1.schema';

@Injectable()
export class ExtractNode implements PipelineNode {
  readonly name = CurrentNode.EXTRACT;
  private readonly nextNode = CurrentNode.CLASSIFY;
  private readonly maxAttempts = 2;
  private readonly logger = new Logger(ExtractNode.name);

  constructor(
    registry: NodeRegistry,
    private readonly tools: ToolRegistry,
    private readonly requests: RequestModelAction,
    private readonly attachments: AttachmentModelAction,
    private readonly extractions: ExtractionModelAction,
    private readonly lineItems: LineItemModelAction,
    private readonly events: EventsService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    registry.register(this);
  }

  /** Runs the bounded extraction loop: LLM call, schema check, reconcile, one re-ask, fail closed. */
  async run(ctx: NodeContext): Promise<NodeResult> {
    const { requestId, orgId } = ctx;
    const start = Date.now();

    const existing = await this.extractions.findByRequestId(requestId);
    if (existing?.schema_valid) {
      return { kind: 'advance', next: this.nextNode };
    }

    const req = await this.requests.get({
      identifierOptions: { id: requestId, org_id: orgId },
    });
    if (!req) {
      return { kind: 'failed', error: { message: SYS_MSG.REQUEST_NOT_FOUND(requestId) } };
    }
    const text = await this.aggregateSourceText(requestId, req.source_subject, req.source_body);

    if (!text.trim()) {
      const elapsedMs = Date.now() - start;
      await this.persistFailure(
        requestId,
        { failure_code: EXTRACTION_FAILURE_EMPTY_SOURCE },
        0,
        elapsedMs,
      );
      await this.emitExited(
        requestId,
        orgId,
        false,
        0,
        elapsedMs,
        SYS_MSG.EXTRACTION_SOURCE_TEXT_EMPTY,
      );
      this.logger.warn({ event: 'extraction_empty_source', requestId });
      return { kind: 'advance', next: this.nextNode };
    }

    let priorFailure: string | null = null;
    let lastRaw: Record<string, unknown> = {};

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      const invocation: Awaited<ReturnType<ToolRegistry['invoke']>> = await this.tools.invoke(
        toToolName('extract_request'),
        { text, priorFailure },
        requestId,
        attempt,
      );

      if (invocation.status !== ToolStatus.OK || invocation.result === undefined) {
        priorFailure = invocation.error ?? SYS_MSG.EXTRACTION_TOOL_FAILED;
        continue;
      }

      if (invocation.result && typeof invocation.result === 'object') {
        lastRaw = invocation.result as Record<string, unknown>;
      }

      const parsed = ExtractionV1Schema.safeParse(invocation.result);
      if (!parsed.success) {
        priorFailure = formatSchemaError(parsed.error);
        continue;
      }

      const extracted = parsed.data;
      lastRaw = extracted as unknown as Record<string, unknown>;

      const recon = reconcile(extracted, text);
      if (!recon.ok) {
        priorFailure = recon.reason;
        continue;
      }

      await this.persistSuccess(requestId, orgId, extracted, attempt - 1, Date.now() - start);
      await this.emitExited(requestId, orgId, true, attempt - 1, Date.now() - start);
      return { kind: 'advance', next: this.nextNode };
    }

    await this.persistFailure(requestId, lastRaw, this.maxAttempts - 1, Date.now() - start);
    await this.emitExited(requestId, orgId, false, this.maxAttempts - 1, Date.now() - start);
    this.logger.warn({
      event: 'extraction_escalated',
      requestId,
      message: SYS_MSG.EXTRACTION_ESCALATED,
    });
    return { kind: 'advance', next: this.nextNode };
  }

  private async aggregateSourceText(
    requestId: string,
    subject: string | null,
    body: string | null,
  ): Promise<string> {
    const parts: string[] = [];
    if (subject?.trim()) {
      parts.push(subject.trim());
    }
    if (body?.trim()) {
      parts.push(body.trim());
    }

    const { payload: attachmentRows } = await this.attachments.find({
      findOptions: { request_id: requestId },
      transactionOptions: { useTransaction: false },
    });

    for (const attachment of attachmentRows) {
      if (attachment.parsed_text?.trim()) {
        parts.push(attachment.parsed_text.trim());
      }
    }

    return parts.join('\n\n');
  }

  private async persistSuccess(
    requestId: string,
    orgId: string,
    extracted: ExtractionV1,
    reextractCount: number,
    latencyMs: number,
  ): Promise<void> {
    await this.dataSource.transaction(async (transaction) => {
      await this.extractions.upsertForRequest(
        {
          requestId,
          model: extractionModelName(),
          schemaValid: true,
          status: ExtractionStatus.COMPLETED,
          rawJson: extracted as unknown as Record<string, unknown>,
          reextractCount,
          latencyMs,
        },
        transaction,
      );

      await this.lineItems.replaceForRequest(
        requestId,
        extracted.line_items.map((item) => ({
          position: item.position,
          raw_text: item.raw_text,
          quantity: item.quantity,
          unit: item.unit,
        })),
        transaction,
      );

      const result = await this.requests.update({
        identifierOptions: { id: requestId, org_id: orgId },
        updatePayload: {
          sender_company: extracted.company,
          sender_contact: extracted.contact,
          sender_email: extracted.sender_email,
          delivery_date: extracted.delivery_date,
        },
        transactionOptions: { useTransaction: true, transaction },
      });

      if (!result) {
        throw new Error(SYS_MSG.REQUEST_NOT_FOUND(requestId));
      }
    });
  }

  private async persistFailure(
    requestId: string,
    rawJson: Record<string, unknown>,
    reextractCount: number,
    latencyMs: number,
  ): Promise<void> {
    await this.extractions.upsertForRequest({
      requestId,
      model: extractionModelName(),
      schemaValid: false,
      status: ExtractionStatus.FAILED,
      rawJson,
      reextractCount,
      latencyMs,
    });
  }

  private async emitExited(
    requestId: string,
    orgId: string,
    schemaValid: boolean,
    reextractCount: number,
    elapsedMs: number,
    exitMessage?: string,
  ): Promise<void> {
    const message =
      exitMessage ?? (schemaValid ? SYS_MSG.EXTRACTION_COMPLETE : SYS_MSG.EXTRACTION_ESCALATED);
    try {
      await this.events.emit({
        eventName: 'node.exited',
        orgId,
        requestId,
        attributes: {
          node: this.name,
          next: this.nextNode,
          schema_valid: schemaValid,
          reextract_count: reextractCount,
          elapsed_ms: elapsedMs,
          message,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to emit node.exited for request ${requestId}`, err);
    }
  }
}
