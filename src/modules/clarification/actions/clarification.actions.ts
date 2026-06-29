import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbstractModelAction } from '@common/model-action/abstract.model-action';
import { Clarification } from '../entities/clarification.entity';

@Injectable()
export class ClarificationActions extends AbstractModelAction<Clarification> {
  constructor(
    @InjectRepository(Clarification)
    private readonly clarificationRepository: Repository<Clarification>,
  ) {
    super(clarificationRepository, Clarification);
  }

  async findByRequestId(requestId: string): Promise<Clarification | null> {
    return this.clarificationRepository.findOne({
      where: { request_id: requestId },
    });
  }

  async updateDraft(
    id: string,
    draft_subject: string | null,
    draft_body: string | null,
  ): Promise<Clarification | null> {
    await this.clarificationRepository.update(id, { draft_subject, draft_body });
    return this.clarificationRepository.findOne({ where: { id } });
  }

  async markSent(id: string, sentBy: string): Promise<Clarification | null> {
    await this.clarificationRepository.update(id, {
      sent_at: new Date(),
      sent_by: sentBy,
    });
    return this.clarificationRepository.findOne({ where: { id } });
  }
}
