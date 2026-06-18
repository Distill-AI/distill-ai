import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { numericTransformer } from '@common/transformers/numeric.transformer';
import { MatchMethod } from '../enums/match-method.enum';
import { Request } from '../../requests/entities/request.entity';
import { Sku } from './sku.entity';

@Entity('line_items')
export class LineItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  request_id: string;

  @ManyToOne(() => Request)
  @JoinColumn({ name: 'request_id' })
  request: Request;

  @Column({ type: 'smallint' })
  position: number;

  @Column({ type: 'text' })
  raw_text: string;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  quantity: number | null;

  @Column({ type: 'text', nullable: true })
  unit: string | null;

  @Column({ type: 'uuid', nullable: true })
  matched_sku_id: string | null;

  @ManyToOne(() => Sku, { nullable: true })
  @JoinColumn({ name: 'matched_sku_id' })
  matched_sku: Sku | null;

  @Column({
    type: 'numeric',
    precision: 4,
    scale: 3,
    nullable: true,
    transformer: numericTransformer,
  })
  match_confidence: number | null;

  @Column({ type: 'enum', enum: MatchMethod, enumName: 'match_method', nullable: true })
  match_method: MatchMethod | null;

  @Column({ type: 'int', nullable: true })
  unit_price_minor: number | null;

  @Column({ type: 'smallint', nullable: true })
  lead_time_days: number | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  flags: unknown[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;
}
