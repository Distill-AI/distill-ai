import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { QuoteStatus } from '../enums/quote-status.enum';
import { Organization } from '../../organizations/entities/organization.entity';
import { Request } from '../../requests/entities/request.entity';
import { User } from '../../users/entities/user.entity';

@Entity('quotes')
@Unique('quotes_org_quote_number_unique', ['org_id', 'quote_number'])
export class Quote extends BaseEntity {
  @Column({ type: 'uuid' })
  org_id: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @Column({ type: 'uuid' })
  request_id: string;

  @ManyToOne(() => Request)
  @JoinColumn({ name: 'request_id' })
  request: Request;

  @Column({ type: 'text' })
  quote_number: string;

  @Column({ type: 'enum', enum: QuoteStatus, enumName: 'quote_status', default: QuoteStatus.DRAFT })
  status: QuoteStatus;

  @Column({ type: 'int' })
  subtotal_minor: number;

  @Column({ type: 'int', default: 0 })
  discount_minor: number;

  @Column({ type: 'int' })
  total_minor: number;

  @Column({ type: 'text', default: 'GBP' })
  currency: string;

  @Column({ type: 'text', nullable: true })
  terms: string | null;

  @Column({ type: 'smallint', nullable: true })
  lead_time_days: number | null;

  @Column({ type: 'date', nullable: true })
  valid_until: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  created_by_user: User | null;

  @Column({ type: 'uuid', nullable: true })
  approved_by: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approved_by_user: User | null;

  @Column({ type: 'text', nullable: true })
  pdf_storage_url: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  pdf_generated_at: Date | null;
}
