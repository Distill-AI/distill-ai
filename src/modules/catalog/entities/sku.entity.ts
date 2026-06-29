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

  // Unit cost in minor units, used by the policy node to evaluate gross margin (US-E4-2).
  @Column({ type: 'int', nullable: true })
  cost_minor: number | null;

  @Column({ type: 'text', default: 'GBP' })
  currency: string;

  @Column({ type: 'smallint', nullable: true })
  lead_time_days: number | null;

  // DB column is vector(1024), sized for Qwen text-embedding-v4. Declared as text so TypeORM
  // can read it without a custom type.
  // insert: false / update: false makes this ORM-read-only: save() will never attempt to write
  // a text value into a vector column, preventing a runtime type mismatch.
  // To write embeddings use a raw query or a dedicated repository method that casts to vector.
  // When running migration:generate, remove any ALTER COLUMN for this field (known type drift).
  @Column({ type: 'text', nullable: true, insert: false, update: false })
  embedding: string | null;
}
