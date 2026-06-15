import { Entity, Column, ManyToOne, JoinColumn, ManyToMany, JoinTable } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Role } from '../../roles/entities/role.entity';
import { Sector } from '../../sectors/entities/sector.entity';

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
    employeeId!: string | null;

    @Column({ type: 'nvarchar', length: 50, nullable: true })
    externalAuthProvider!: string | null;

    @Column({ type: 'nvarchar', length: 255, nullable: true })
    externalAuthId!: string | null;

    @Column({ type: 'nvarchar', length: 100, nullable: true })
    externalTenantId!: string | null;

    @Column({ type: 'nvarchar', length: 200, nullable: true })
    displayName!: string | null;

    @Column({ type: 'nvarchar', length: 20, nullable: true })
    licensePlate!: string | null;

    @Column({ type: 'nvarchar', length: 50, nullable: true })
    badge!: string | null;

    @Column({ type: 'datetime2', nullable: true })
    lastExternalLoginAt!: Date | null;

    @Column({ type: 'uniqueidentifier', nullable: true })
    sectorId!: string | null;

    @ManyToOne(() => Sector, { eager: false, nullable: true })
    @JoinColumn({ name: 'sectorId' })
    sector!: Sector | null;

    @Column({ type: 'uniqueidentifier', nullable: true })
    roleId!: string | null;

    @ManyToOne(() => Role, (role) => role.users, { eager: false, nullable: true })
    @JoinColumn({ name: 'roleId' })
    role!: Role | null;

    @ManyToMany(() => Role, { eager: false })
    @JoinTable({
        name: 'UserRoles',
        joinColumn: { name: 'userId', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'roleId', referencedColumnName: 'id' },
    })
    roles!: Role[];
}
