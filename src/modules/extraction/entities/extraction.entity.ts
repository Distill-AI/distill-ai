import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Request } from '../../requests/entities/request.entity';

@Entity('extractions')
export class Extraction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  request_id: string;

  @OneToOne(() => Request)
  @JoinColumn({ name: 'request_id' })
  request: Request;

  @Column({ type: 'text' })
  model: string;

  @Column({ type: 'boolean' })
  schema_valid: boolean;

  @Column({ type: 'jsonb' })
  raw_json: Record<string, unknown>;

  @Column({ type: 'smallint', default: 0 })
  reextract_count: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  loop_steps: unknown[];

  @Column({ type: 'int', nullable: true })
  latency_ms: number | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;
}
