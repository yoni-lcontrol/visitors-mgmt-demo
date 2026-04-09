import { Entity, Column, ManyToMany, JoinTable, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Role } from '../../roles/entities/role.entity';

@Entity('Users')
export class User extends BaseEntity {
    @Column({ type: 'nvarchar', length: 255, unique: true })
    username!: string;

    @Column({ type: 'nvarchar', length: 255, nullable: true })
    passwordHash!: string | null;

    @Column({ type: 'nvarchar', length: 100 })
    firstName!: string;

    @Column({ type: 'nvarchar', length: 100 })
    lastName!: string;

    @Column({ type: 'nvarchar', length: 255, nullable: true })
    email!: string | null;

    @Column({ type: 'nvarchar', length: 50, nullable: true })
    phone!: string | null;

    @Column({ type: 'datetime2', nullable: true })
    lastLoginAt!: Date | null;

    @Column({ type: 'uniqueidentifier', nullable: true })
    adSourceId!: string | null;

    @Column({ type: 'nvarchar', length: 255, nullable: true })
    adExternalId!: string | null;

    @Column({ type: 'datetime2', nullable: true })
    lastSyncedAt!: Date | null;

    @Column({ type: 'nvarchar', length: 20, default: 'local' })
    syncSource!: string;

    @Column({ type: 'nvarchar', length: 200, nullable: true })
    department!: string | null;

    @Column({ type: 'nvarchar', length: 200, nullable: true })
    title!: string | null;

    @Column({ type: 'nvarchar', length: 50, nullable: true })
    idNumber!: string | null;

    @Column({ type: 'nvarchar', length: 50, nullable: true })
    externalAuthProvider!: string | null;

    @Column({ type: 'nvarchar', length: 255, nullable: true })
    externalAuthId!: string | null;

    @Column({ type: 'datetime2', nullable: true })
    lastExternalLoginAt!: Date | null;

    @ManyToMany(() => Role, (role) => role.users, { eager: false })
    @JoinTable({
        name: 'UserRoles',
        joinColumn: { name: 'userId', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'roleId', referencedColumnName: 'id' },
    })
    roles!: Role[];
}
