import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ToolCallStatus, ToolTier } from '../enums/tools.enums';
import { Request } from '../../requests/entities/request.entity';

@Entity({ name: 'tool_calls' })
@Index('tool_calls_request_idx', ['request_id', 'created_at'])
export class ToolCallEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  request_id?: string | null;

  @ManyToOne(() => Request, { nullable: true })
  @JoinColumn({ name: 'request_id' })
  request?: Request | null;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  tool_name: string;

  @Column({
    type: 'enum',
    enum: ToolCallStatus,
    enumName: 'tool_call_status',
    default: ToolCallStatus.OK,
  })
  @Index()
  status: ToolCallStatus;

  @Column({ type: 'int' })
  latency_ms: number;

  @Column({ type: 'jsonb', nullable: true })
  input_args: unknown;

  @Column({ type: 'jsonb', nullable: true })
  output_result: unknown;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @Column({
    type: 'enum',
    enum: ToolTier,
    enumName: 'tool_tier',
  })
  tier: ToolTier;

  @CreateDateColumn({ type: 'timestamptz' })
  @Index()
  created_at: Date;
}
