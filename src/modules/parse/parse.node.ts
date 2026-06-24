import { Inject, Injectable, Logger } from '@nestjs/common';
import * as SYS_MSG from '@constants/system-messages';
import { CurrentNode } from '@modules/requests/enums/current-node.enum';
import { ParseStatus } from '@modules/requests/enums/parse-status.enum';
import { ParseErrorReason } from '@modules/requests/enums/parse-error-reason.enum';
import { RequestModelAction } from '@modules/requests/requests.model-action';
import { AttachmentModelAction } from '@modules/requests/attachments.model-action';
import { OBJECT_STORE, type ObjectStore } from '@common/object-store/object-store.port';
import { NodeRegistry } from '@modules/pipeline/node-registry';
import { EventsService } from '@modules/events/events.service';
import type { NodeContext, NodeResult, PipelineNode } from '@modules/pipeline/types';
import { extractText } from './text-extractor';

/**
 * Parse node (US-E1-1-T3): reads each attachment's bytes from the object store, extracts text,
 * and writes it to `attachments.parsed_text` for the downstream extract step. Attachments the
 * estimator already pasted manually (parse_status = manual_paste) are skipped. A parse failure
 * is fail-fast: the attachment is marked unparsed, a stage.error event is emitted, and the
 * node returns clarify so the estimator is prompted to paste content.
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
    private readonly events: EventsService,
  ) {
    registry.register(this);
  }

  async run(ctx: NodeContext): Promise<NodeResult> {
    const { requestId, orgId } = ctx;

    const req = await this.requests.get({ identifierOptions: { id: requestId, org_id: orgId } });
    if (!req) {
      return { kind: 'failed', error: { message: SYS_MSG.REQUEST_NOT_FOUND(requestId) } };
    }

    const { payload: attachmentList } = await this.attachments.find({
      findOptions: { request_id: requestId },
      transactionOptions: { useTransaction: false },
    });

    for (const attachment of attachmentList) {
      if (attachment.parse_status === ParseStatus.MANUAL_PASTE) {
        continue;
      }

      let parsedText: string;
      try {
        const bytes = await this.store.get(attachment.storage_url);
        parsedText = await extractText(bytes, attachment.filename);
      } catch (err) {
        const reason =
          err instanceof Error && err.message.includes('unsupported file type')
            ? ParseErrorReason.UNSUPPORTED_FORMAT
            : ParseErrorReason.UNKNOWN;
        await this.attachments.markUnparsed(attachment.id, reason);
        await this.events.emit({
          eventName: 'stage.error',
          orgId,
          requestId,
          attributes: {
            stage: 'parse',
            reason,
            escalated_to_human: true,
          },
        });
        this.logger.warn({
          event: 'parse_attachment_failed',
          requestId,
          attachmentId: attachment.id,
          filename: attachment.filename,
          error: (err as Error).message,
        });
        return { kind: 'clarify' };
      }

      await this.attachments.update({
        identifierOptions: { id: attachment.id },
        updatePayload: {
          parsed_text: parsedText,
          parse_status: ParseStatus.PARSED,
          parse_error_reason: null,
        },
        transactionOptions: { useTransaction: false },
      });
    }

    return { kind: 'advance', next: this.nextNode };
  }
}
