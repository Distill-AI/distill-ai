import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { numericTransformer } from '@common/transformers/numeric.transformer';
import { RequestChannel } from '../enums/request-channel.enum';
import { RequestType } from '../enums/request-type.enum';
import { RequestStatus } from '../enums/request-status.enum';
import { CurrentNode } from '../enums/current-node.enum';
import { RequestRouting } from '../enums/request-routing.enum';
import { Organization } from '../../organizations/entities/organization.entity';

@Index('requests_stale_processing_idx', ['processing_started_at'], { where: "status = 'parsing'" })
@Entity('requests')
export class Request extends BaseEntity {
  @Column({ type: 'uuid' })
  org_id: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @Column({ type: 'enum', enum: RequestChannel, enumName: 'request_channel' })
  channel: RequestChannel;

  @Column({ type: 'text', nullable: true })
  source_subject: string | null;

  @Column({ type: 'text', nullable: true })
  source_body: string | null;

  @Column({ type: 'text', nullable: true })
  sender_company: string | null;

  @Column({ type: 'text', nullable: true })
  sender_contact: string | null;

  // DB column is citext (set by migration) — TypeORM sees text; compatible at runtime.
  // When running migration:generate, remove any ALTER COLUMN for this field.
  @Column({ type: 'text', nullable: true })
  sender_email: string | null;

  @Column({
    type: 'enum',
    enum: RequestType,
    enumName: 'request_type',
    default: RequestType.UNKNOWN,
  })
  request_type: RequestType;

  @Column({
    type: 'enum',
    enum: RequestStatus,
    enumName: 'request_status',
    default: RequestStatus.RECEIVED,
  })
  status: RequestStatus;

  // Added by migration 0002 (US-E8-3-T2)
  @Column({ type: 'enum', enum: CurrentNode, enumName: 'current_node', default: CurrentNode.PARSE })
  current_node: CurrentNode;

  // Added by migration 0002 (US-E8-3-T2)
  @Column({ type: 'timestamptz', nullable: true })
  processing_started_at: Date | null;

  @Column({
    type: 'numeric',
    precision: 4,
    scale: 3,
    nullable: true,
    transformer: numericTransformer,
  })
  overall_confidence: number | null;

  // Added by migration 1781772970268 (US-E2-4)
  @Column({
    type: 'numeric',
    precision: 3,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  classification_confidence: number | null;

  @Column({ type: 'enum', enum: RequestRouting, enumName: 'request_routing', nullable: true })
  routing: RequestRouting | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  routing_reasons: unknown[];

  @Column({ type: 'date', nullable: true })
  delivery_date: string | null;
}
