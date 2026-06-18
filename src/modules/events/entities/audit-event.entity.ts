import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import { Request } from '../../requests/entities/request.entity';
import { Quote } from '../../quotes/entities/quote.entity';
import { User } from '../../users/entities/user.entity';

@Entity('audit_events')
export class AuditEvent {
  // bigint identity PK — migration creates BIGINT GENERATED ALWAYS AS IDENTITY
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'uuid' })
  org_id: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @Column({ type: 'uuid', nullable: true })
  request_id: string | null;

  @ManyToOne(() => Request, { nullable: true })
  @JoinColumn({ name: 'request_id' })
  request: Request | null;

  @Column({ type: 'uuid', nullable: true })
  quote_id: string | null;

  @ManyToOne(() => Quote, { nullable: true })
  @JoinColumn({ name: 'quote_id' })
  quote: Quote | null;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ type: 'text' })
  event_name: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  attributes: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;
}
