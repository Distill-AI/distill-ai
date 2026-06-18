import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ToolName } from '../enums/tool-name.enum';
import { ToolCallStatus } from '../enums/tool-call-status.enum';
import { Request } from '../../requests/entities/request.entity';

@Entity('tool_calls')
@Index('tool_calls_request_idx', ['request_id', 'created_at'])
export class ToolCall {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  request_id: string;

  @ManyToOne(() => Request)
  @JoinColumn({ name: 'request_id' })
  request: Request;

  @Column({ type: 'enum', enum: ToolName, enumName: 'tool_name' })
  tool_name: ToolName;

  @Column({ type: 'jsonb' })
  args: Record<string, unknown>;

  @Column({ type: 'enum', enum: ToolCallStatus, enumName: 'tool_call_status' })
  status: ToolCallStatus;

  @Column({ type: 'int', nullable: true })
  latency_ms: number | null;

  @Column({ type: 'jsonb', nullable: true })
  error_detail: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;
}
