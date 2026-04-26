import { Entity, Column, ManyToMany, JoinTable, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Permission } from '../../permissions/entities/permission.entity';

@Entity('Roles')
export class Role extends BaseEntity {
    @Column({ type: 'nvarchar', length: 100, unique: true })
    name!: string;

    @Column({ type: 'nvarchar', length: 500, nullable: true })
    description!: string | null;

    @Column({ type: 'bit', default: false })
    isSystem!: boolean;

    @OneToMany(() => User, (user) => user.role)
    users!: User[];

    @ManyToMany(() => Permission, (permission) => permission.roles, {
        eager: false,
    })
    @JoinTable({
        name: 'RolePermissions',
        joinColumn: { name: 'roleId', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'permissionId', referencedColumnName: 'id' },
    })
    permissions!: Permission[];
}
