import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { toToolName } from '@modules/pipeline/types';
import type { DeepPartial } from 'typeorm';
import * as SYS_MSG from '@constants/system-messages';
import { ToolRegistry } from '@modules/tools/registry';
import { ClarificationActions } from './actions/clarification.actions';
import { DraftClarificationToolFactory } from './tools/draft-clarification.tool';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import type { Clarification } from './entities/clarification.entity';

@Injectable()
export class ClarificationService {
  private readonly logger = new Logger(ClarificationService.name);

  constructor(
    private readonly actions: ClarificationActions,
    private readonly toolRegistry: ToolRegistry,
    private readonly draftToolFactory: DraftClarificationToolFactory,
  ) {}

  async generateDraft(
    requestId: string,
    gaps: string[],
    callerOrgId?: string,
  ): Promise<Clarification> {
    if (!gaps || gaps.length === 0 || gaps.some((gap) => gap.trim().length === 0)) {
      throw new CustomHttpException(SYS_MSG.CLARIFICATION_NO_GAPS, HttpStatus.BAD_REQUEST);
    }

    if (callerOrgId !== undefined) {
      const requestOrgId = await this.actions.findRequestOrgId(requestId);
      if (!requestOrgId || requestOrgId !== callerOrgId) {
        throw new CustomHttpException(SYS_MSG.CLARIFICATION_NOT_FOUND, HttpStatus.NOT_FOUND);
      }
    }

    const toolName = toToolName('draft_clarification');

    let draft_subject: string | null = null;
    let draft_body: string | null = null;
    let generationSucceeded = false;

    try {
      const result = await this.toolRegistry.invoke(toolName, { gaps, requestId }, requestId);

      if (result.status === 'ok' && result.result) {
        const output = result.result as { draft_subject: string; draft_body: string };
        draft_subject = output.draft_subject;
        draft_body = output.draft_body;
        generationSucceeded = true;
      } else {
        this.logger.warn(`Draft generation failed for request ${requestId}: ${result.error}`);
      }
    } catch (err) {
      this.logger.error(
        `Draft generation error for request ${requestId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const existing = await this.actions.findByRequestId(requestId);

    if (existing) {
      if (!generationSucceeded) {
        return existing;
      }

      if (existing.sent_at) {
        return existing;
      }

      const updated = await this.actions.updateDraft(existing.id, draft_subject, draft_body, gaps);
      if (!updated) {
        throw new CustomHttpException(SYS_MSG.CLARIFICATION_NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      return updated;
    }

    if (!generationSucceeded) {
      throw new CustomHttpException(
        SYS_MSG.CLARIFICATION_DRAFT_PARSE_FAILED,
        HttpStatus.FAILED_DEPENDENCY,
      );
    }

    const created = await this.actions.create({
      createPayload: {
        request_id: requestId,
        gaps,
        draft_subject,
        draft_body,
        sent_at: null,
        sent_by: null,
      } as DeepPartial<Clarification>,
      transactionOptions: { useTransaction: false },
    });

    return created;
  }

  async getByRequestId(requestId: string, callerOrgId?: string): Promise<Clarification> {
    const clarification = await this.actions.findByRequestId(requestId, callerOrgId);
    if (!clarification) {
      throw new CustomHttpException(SYS_MSG.CLARIFICATION_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    return clarification;
  }

  async getById(id: string, callerOrgId?: string): Promise<Clarification> {
    const clarification = await this.actions.findByIdWithOrg(id, callerOrgId);
    if (!clarification) {
      throw new CustomHttpException(SYS_MSG.CLARIFICATION_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    return clarification;
  }

  async updateDraft(
    id: string,
    draft_subject?: string,
    draft_body?: string,
    callerOrgId?: string,
  ): Promise<Clarification> {
    const existing = await this.getById(id, callerOrgId);

    if (existing.sent_at) {
      throw new CustomHttpException(SYS_MSG.CLARIFICATION_ALREADY_SENT, HttpStatus.CONFLICT);
    }

    const updated = await this.actions.updateDraft(
      id,
      draft_subject ?? existing.draft_subject,
      draft_body ?? existing.draft_body,
    );

    if (!updated) {
      throw new CustomHttpException(SYS_MSG.CLARIFICATION_NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    return updated;
  }

  async send(id: string, sentBy?: string, callerOrgId?: string): Promise<Clarification> {
    if (callerOrgId !== undefined && !sentBy) {
      throw new CustomHttpException(
        SYS_MSG.CLARIFICATION_SEND_ACTOR_REQUIRED,
        HttpStatus.BAD_REQUEST,
      );
    }

    const clarification = await this.getById(id, callerOrgId);

    if (clarification.sent_at) {
      return clarification;
    }

    if (!clarification.draft_subject?.trim() || !clarification.draft_body?.trim()) {
      throw new CustomHttpException(
        SYS_MSG.CLARIFICATION_DRAFT_EMPTY,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const updated = await this.actions.markSent(id, sentBy);

    if (!updated) {
      const recheck = await this.actions.findByIdWithOrg(id, callerOrgId);
      if (recheck?.sent_at) {
        return recheck;
      }
      throw new CustomHttpException(SYS_MSG.CLARIFICATION_NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    return updated;
  }
}
