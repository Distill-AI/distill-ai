import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { Organization } from '../../organizations/entities/organization.entity';

@Entity('skus')
@Unique('skus_org_sku_code_unique', ['org_id', 'sku_code'])
export class Sku extends BaseEntity {
  @Column({ type: 'uuid' })
  org_id: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @Column({ type: 'text' })
  sku_code: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  attributes: Record<string, unknown>;

  @Column({ type: 'int' })
  base_price_minor: number;

  @Column({ type: 'text', default: 'GBP' })
  currency: string;

  @Column({ type: 'smallint', nullable: true })
  lead_time_days: number | null;

  // DB column is VECTOR(384) (set by migration) — TypeORM sees text; never write via ORM.
  // When running migration:generate, remove any ALTER COLUMN for this field.
  @Column({ type: 'text', nullable: true })
  embedding: string | null;
}
