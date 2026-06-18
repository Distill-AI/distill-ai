import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Quote } from './quote.entity';
import { Sku } from '../../catalog/entities/sku.entity';

@Entity('quote_line_items')
export class QuoteLineItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  quote_id: string;

  @ManyToOne(() => Quote)
  @JoinColumn({ name: 'quote_id' })
  quote: Quote;

  @Column({ type: 'uuid', nullable: true })
  sku_id: string | null;

  @ManyToOne(() => Sku, { nullable: true })
  @JoinColumn({ name: 'sku_id' })
  sku: Sku | null;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  quantity: number;

  @Column({ type: 'int' })
  unit_price_minor: number;

  @Column({ type: 'int' })
  amount_minor: number;

  @Column({ type: 'smallint' })
  position: number;
}
