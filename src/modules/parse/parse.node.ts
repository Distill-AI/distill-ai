import { Inject, Injectable, Logger } from '@nestjs/common';
import * as SYS_MSG from '@constants/system-messages';
import { CurrentNode } from '@modules/requests/enums/current-node.enum';
import { RequestModelAction } from '@modules/requests/requests.model-action';
import { AttachmentModelAction } from '@modules/requests/attachments.model-action';
import { OBJECT_STORE, type ObjectStore } from '@common/object-store/object-store.port';
import { NodeRegistry } from '@modules/pipeline/node-registry';
import type { NodeContext, NodeResult, PipelineNode } from '@modules/pipeline/types';
import { extractText } from './text-extractor';

/**
 * Parse node (US-E1-1-T3): the real `parse` step. Reads each attachment's original bytes from the
 * object store, extracts text by type (PDF/CSV/TXT), and writes it to `attachments.parsed_text` for
 * the downstream extract step. Paste-only requests have no attachments and simply advance (their text
 * already lives in `source_body`). Extraction is best-effort per file: one unreadable attachment is
 * logged and stored as null rather than failing the whole request.
 */
@Injectable()
export class ParseNode implements PipelineNode {
  readonly name = CurrentNode.PARSE;
  private readonly nextNode = CurrentNode.EXTRACT;
  private readonly logger = new Logger(ParseNode.name);

  constructor(
    registry: NodeRegistry,
    private readonly requests: RequestModelAction,
    private readonly attachments: AttachmentModelAction,
    @Inject(OBJECT_STORE) private readonly store: ObjectStore,
  ) {
    registry.register(this);
  }

  async run(ctx: NodeContext): Promise<NodeResult> {
    const { requestId, orgId } = ctx;

    const req = await this.requests.get({ identifierOptions: { id: requestId, org_id: orgId } });
    if (!req) {
      return { kind: 'failed', error: { message: SYS_MSG.REQUEST_NOT_FOUND(requestId) } };
    }

    const { payload: attachments } = await this.attachments.find({
      findOptions: { request_id: requestId },
      transactionOptions: { useTransaction: false },
    });

    let extracted = 0;
    let failed = 0;
    for (const attachment of attachments) {
      try {
        const bytes = await this.store.get(attachment.storage_url);
        const text = await extractText(bytes, attachment.filename);
        await this.attachments.update({
          identifierOptions: { id: attachment.id },
          updatePayload: { parsed_text: text },
          transactionOptions: { useTransaction: false },
        });
        extracted++;
      } catch (err) {
        // Best-effort: a single unreadable file must not sink a multi-file request. Record null so a
        // re-run is idempotent and the downstream step sees "no text" rather than stale content.
        failed++;
        this.logger.warn({
          event: 'parse_attachment_failed',
          requestId,
          attachmentId: attachment.id,
          filename: attachment.filename,
          error: (err as Error).message,
        });
        await this.attachments.update({
          identifierOptions: { id: attachment.id },
          updatePayload: { parsed_text: null },
          transactionOptions: { useTransaction: false },
        });
      }
    }

    this.logger.log({
      event: 'parse_complete',
      requestId,
      attachments: attachments.length,
      extracted,
      failed,
    });

    return { kind: 'advance', next: this.nextNode };
  }
}
