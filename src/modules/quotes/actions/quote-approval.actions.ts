import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import * as SYS_MSG from '@constants/system-messages';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import { EventsService } from '@modules/events/events.service';
import { ToolRegistry } from '@modules/tools/registry';
import { ToolStatus } from '@modules/tools/enums/tools.enums';
import { toToolName } from '@modules/pipeline/types';
import { QUOTE_APPROVABLE_STATUSES } from '@modules/requests/constants/quote-approval.constants';
import type { Request } from '@modules/requests/entities/request.entity';
import { QuoteModelAction } from '../quote.model-action';
import { QuoteStatus } from '../enums/quote-status.enum';
import type { Quote } from '../entities/quote.entity';
import type { QuoteLineItem } from '../entities/quote-line-item.entity';
import { toQuoteDetail } from '../mappers/quote-detail.mapper';
import type { ApproveQuoteResponsePayload } from '../interfaces/approve-quote.interface';

@Injectable()
export class QuoteApprovalActions {
  private readonly logger = new Logger(QuoteApprovalActions.name);

  constructor(
    private readonly quotes: QuoteModelAction,
    private readonly toolRegistry: ToolRegistry,
    private readonly events: EventsService,
  ) {}

  /**
   * Approves a priced quote for a request: claims it atomically, renders its PDF via
   * render_quote_pdf, best-effort drafts a follow-up email, and emits `quote.approved`/`quote.ready`.
   * Idempotent: an already-`READY` quote returns its existing payload without re-invoking the tool.
   * Takes the already-loaded `request` so the caller's org check and this approval share one fetch.
   */
  async approveAndGenerate(
    request: Request,
    orgId: string | undefined,
    userId: string | undefined,
  ): Promise<ApproveQuoteResponsePayload> {
    const requestId = request.id;
    if (!QUOTE_APPROVABLE_STATUSES.includes(request.status)) {
      throw new CustomHttpException(
        SYS_MSG.QUOTE_REQUEST_NOT_APPROVABLE(request.status),
        HttpStatus.CONFLICT,
      );
    }

    const found = await this.quotes.getForRequest(requestId);
    if (!found) {
      throw new CustomHttpException(SYS_MSG.QUOTE_NOT_PRICED(requestId), HttpStatus.CONFLICT);
    }
    const { quote, lines } = found;

    if (quote.status === QuoteStatus.READY) {
      return this.toPayload(quote, lines);
    }

    if (quote.status === QuoteStatus.APPROVED) {
      // Someone else already holds the claim (EC-03: a concurrent approval, or this exact quote
      // mid-generation from an earlier call). This caller does not re-invoke render_quote_pdf -
      // that would defeat the "exactly one tool_calls row per approval" guarantee - it returns the
      // in-progress state; the client picks up pdf_storage_url on its next read once the claimer
      // finishes.
      return this.toPayload(quote, lines);
    }

    if (quote.status !== QuoteStatus.DRAFT) {
      throw new CustomHttpException(
        SYS_MSG.QUOTE_INVALID_TRANSITION(quote.status),
        HttpStatus.CONFLICT,
      );
    }

    const claimed = await this.quotes.tryClaimForApproval(quote.id, userId ?? null);
    if (!claimed) {
      const current = await this.quotes.getByIdWithLines(quote.id);
      if (!current) {
        throw new CustomHttpException(SYS_MSG.QUOTE_NOT_FOUND(quote.id), HttpStatus.NOT_FOUND);
      }
      if (
        current.quote.status === QuoteStatus.READY ||
        current.quote.status === QuoteStatus.APPROVED
      ) {
        return this.toPayload(current.quote, current.lines);
      }
      throw new CustomHttpException(
        SYS_MSG.QUOTE_INVALID_TRANSITION(current.quote.status),
        HttpStatus.CONFLICT,
      );
    }

    let output: { storageUrl: string };
    try {
      await this.events.emit({
        eventName: 'quote.approved',
        orgId,
        requestId,
        quoteId: quote.id,
        userId,
        attributes: {},
      });

      const toolName = toToolName('render_quote_pdf');
      const result = await this.toolRegistry.invoke(
        toolName,
        { quoteId: quote.id, idempotencyKey: quote.id },
        requestId,
        1,
        orgId ?? null,
      );
      if (result.status !== ToolStatus.OK) {
        throw new CustomHttpException(
          SYS_MSG.QUOTE_PDF_GENERATION_FAILED,
          HttpStatus.FAILED_DEPENDENCY,
        );
      }
      output = result.result as { storageUrl: string };
    } catch (err) {
      await this.quotes.revertToDraft(quote.id);
      throw err;
    }
    const transitioned = await this.quotes.markReady(quote.id, output.storageUrl);
    if (!transitioned) {
      this.logger.warn({
        event: 'quote_mark_ready_no_op',
        quoteId: quote.id,
        message:
          'markReady found the quote no longer APPROVED; it may have been reverted concurrently',
      });
    }

    if (transitioned) {
      await this.events.emit({
        eventName: 'quote.ready',
        orgId,
        requestId,
        quoteId: quote.id,
        attributes: {},
      });

      if (!quote.email_draft_subject) {
        await this.tryDraftEmail(quote, request, requestId, orgId);
      }
    }

    const final = await this.quotes.getByIdWithLines(quote.id);
    if (!final) {
      throw new CustomHttpException(SYS_MSG.QUOTE_NOT_FOUND(quote.id), HttpStatus.NOT_FOUND);
    }
    return this.toPayload(final.quote, final.lines);
  }

  /**
   * Drafts a follow-up email via the draft_quote_email tool and persists it. Best-effort: any
   * failure is logged and swallowed so it never fails the overall approve response, matching
   * ClarificationService.generateDraft's generationSucceeded pattern.
   */
  private async tryDraftEmail(
    quote: Quote,
    request: Request,
    requestId: string,
    orgId: string | undefined,
  ): Promise<void> {
    try {
      const toolName = toToolName('draft_quote_email');
      const result = await this.toolRegistry.invoke(
        toolName,
        {
          quoteNumber: quote.quote_number,
          totalMinor: quote.total_minor,
          currency: quote.currency,
          leadTimeDays: quote.lead_time_days,
          senderContact: request.sender_contact,
          senderCompany: request.sender_company,
        },
        requestId,
        1,
        orgId ?? null,
      );
      if (result.status === ToolStatus.OK && result.result) {
        const output = result.result as { draft_subject: string; draft_body: string };
        await this.quotes.saveEmailDraft(quote.id, output.draft_subject, output.draft_body);
      } else {
        this.logger.warn({
          event: 'quote_email_draft_failed',
          quoteId: quote.id,
          error: result.error,
        });
      }
    } catch (err) {
      this.logger.error({
        event: 'quote_email_draft_error',
        quoteId: quote.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private toPayload(quote: Quote, lines: QuoteLineItem[]): ApproveQuoteResponsePayload {
    return { quote: toQuoteDetail(quote, lines) };
  }
}
