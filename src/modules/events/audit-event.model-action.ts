import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbstractModelAction } from '@common/model-action/abstract.model-action';
import { AuditEvent } from './entities/audit-event.entity';

export interface CreateAuditEventPayload {
  org_id: string;
  request_id: string | null;
  event_name: string;
  attributes: Record<string, unknown>;
}

/** Data-access for the append-only `audit_events` table. Inserts only (never update/delete). */
@Injectable()
export class AuditEventModelAction extends AbstractModelAction<AuditEvent> {
  constructor(
    @InjectRepository(AuditEvent)
    private readonly auditEventRepository: Repository<AuditEvent>,
  ) {
    super(auditEventRepository, AuditEvent);
  }

  /** Insert a stage.error audit row, silently ignoring duplicates per the dedup index (FR-6). */
  async insertStageErrorOrIgnore(payload: CreateAuditEventPayload): Promise<void> {
    await this.auditEventRepository.query(
      `INSERT INTO audit_events (org_id, request_id, event_name, attributes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [payload.org_id, payload.request_id, payload.event_name, JSON.stringify(payload.attributes)],
    );
  }
}
