import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ToolCallStatus } from '../enums/tools.enums';
import { Request } from '../../requests/entities/request.entity';

@Entity({ name: 'tool_calls' })
@Index('tool_calls_request_idx', ['request_id', 'created_at'])
export class ToolCallEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  request_id: string;

  @ManyToOne(() => Request)
  @JoinColumn({ name: 'request_id' })
  request?: Request;

  // varchar (not enum) so the dynamic registry pattern can register tools
  // at startup.  The type-level ToolName boundary in pipeline/types.ts
  // excludes reserved identifiers (price/policy/score) at compile time.
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

  @Column({ type: 'jsonb' })
  args: unknown;

  @Column({ type: 'jsonb', nullable: true })
  error_detail: unknown;

  @CreateDateColumn({ type: 'timestamptz' })
  @Index()
  created_at: Date;
}
