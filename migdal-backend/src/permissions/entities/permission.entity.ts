import { Entity, Column, ManyToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Role } from '../../roles/entities/role.entity';

@Entity('Permissions')
export class Permission extends BaseEntity {
    @Column({ type: 'nvarchar', length: 100, unique: true })
    key!: string;

    @Column({ type: 'nvarchar', length: 200 })
    name!: string;

    @Column({ type: 'nvarchar', length: 500, nullable: true })
    description!: string | null;

    @Column({ type: 'nvarchar', length: 100 })
    module!: string;

    @Column({ type: 'nvarchar', length: 50 })
    action!: string;

    @ManyToMany(() => Role, (role) => role.permissions)
    roles!: Role[];
}
