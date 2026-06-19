import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbstractModelAction } from '@common/model-action/abstract.model-action';
import { AuditEvent } from './entities/audit-event.entity';

/** Data-access for the append-only `audit_events` table. Inserts only (never update/delete). */
@Injectable()
export class AuditEventModelAction extends AbstractModelAction<AuditEvent> {
  constructor(
    @InjectRepository(AuditEvent)
    private readonly auditEventRepository: Repository<AuditEvent>,
  ) {
    super(auditEventRepository, AuditEvent);
  }
}
