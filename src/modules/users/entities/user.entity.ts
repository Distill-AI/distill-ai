import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { UserRole } from '../enums/user-role.enum';
import { Organization } from '../../organizations/entities/organization.entity';

@Entity('users')
@Unique('users_org_email_unique', ['org_id', 'email'])
export class User extends BaseEntity {
  @Column({ type: 'uuid' })
  org_id: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @Column({ type: 'text' })
  email: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'enum', enum: UserRole, enumName: 'user_role', default: UserRole.ESTIMATOR })
  role: UserRole;
}
