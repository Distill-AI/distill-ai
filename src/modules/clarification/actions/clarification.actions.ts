import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
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

  async findByRequestId(requestId: string, orgId?: string): Promise<Clarification | null> {
    if (!orgId) {
      return this.clarificationRepository.findOne({
        where: { request_id: requestId },
      });
    }

    return this.clarificationRepository
      .createQueryBuilder('clarification')
      .innerJoin('clarification.request', 'request')
      .where('clarification.request_id = :requestId', { requestId })
      .andWhere('request.org_id = :orgId', { orgId })
      .getOne();
  }

  async findByIdWithOrg(id: string, orgId?: string): Promise<Clarification | null> {
    if (!orgId) {
      return this.clarificationRepository.findOne({ where: { id } });
    }

    return this.clarificationRepository
      .createQueryBuilder('clarification')
      .innerJoin('clarification.request', 'request')
      .where('clarification.id = :id', { id })
      .andWhere('request.org_id = :orgId', { orgId })
      .getOne();
  }

  async findRequestOrgId(requestId: string): Promise<string | null> {
    const rows = await this.clarificationRepository.query(
      'SELECT org_id FROM requests WHERE id = $1',
      [requestId],
    );
    return rows.length > 0 ? rows[0].org_id : null;
  }

  async updateDraft(
    id: string,
    draft_subject: string | null,
    draft_body: string | null,
    gaps?: string[],
  ): Promise<Clarification | null> {
    if (gaps !== undefined) {
      const result = await this.clarificationRepository.update(
        { id, sent_at: IsNull() },
        { draft_subject, draft_body, gaps },
      );
      if (!result.affected) {
        return null;
      }
    } else {
      const result = await this.clarificationRepository.update(
        { id, sent_at: IsNull() },
        { draft_subject, draft_body },
      );
      if (!result.affected) {
        return null;
      }
    }
    return this.clarificationRepository.findOne({ where: { id } });
  }

  async markSent(id: string, sentBy?: string): Promise<Clarification | null> {
    const result = await this.clarificationRepository.update(
      { id, sent_at: IsNull() },
      { sent_at: new Date(), sent_by: sentBy },
    );
    if (!result.affected) {
      return null;
    }
    return this.clarificationRepository.findOne({ where: { id } });
  }
}
