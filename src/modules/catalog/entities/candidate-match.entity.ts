import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { LineItem } from './line-item.entity';
import { Sku } from './sku.entity';

@Entity('candidate_matches')
@Unique('candidate_matches_line_item_sku_unique', ['line_item_id', 'sku_id'])
export class CandidateMatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  line_item_id: string;

  @ManyToOne(() => LineItem)
  @JoinColumn({ name: 'line_item_id' })
  line_item: LineItem;

  @Column({ type: 'uuid' })
  sku_id: string;

  @ManyToOne(() => Sku)
  @JoinColumn({ name: 'sku_id' })
  sku: Sku;

  @Column({ type: 'numeric', precision: 4, scale: 3 })
  score: number;

  @Column({ type: 'smallint' })
  rank: number;
}
