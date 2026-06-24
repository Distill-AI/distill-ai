import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { ParseStatus } from '../enums/parse-status.enum';
import { ParseErrorReason } from '../enums/parse-error-reason.enum';
import { Request } from './request.entity';

@Entity('attachments')
export class Attachment extends BaseEntity {
  @Column({ type: 'uuid' })
  request_id: string;

  @ManyToOne(() => Request)
  @JoinColumn({ name: 'request_id' })
  request: Request;

  @Column({ type: 'text' })
  filename: string;

  @Column({ type: 'text' })
  mime_type: string;

  @Column({ type: 'int' })
  size_bytes: number;

  @Column({ type: 'text' })
  storage_url: string;

  @Column({ type: 'text', nullable: true })
  parsed_text: string | null;

  @Column({
    type: 'enum',
    enum: ParseStatus,
    enumName: 'attachment_parse_status',
    default: ParseStatus.UNPARSED,
  })
  parse_status: ParseStatus;

  @Column({
    type: 'enum',
    enum: ParseErrorReason,
    enumName: 'attachment_parse_error_reason',
    nullable: true,
  })
  parse_error_reason: ParseErrorReason | null;

  @Column({ type: 'text', nullable: true })
  raw_text: string | null;
}
