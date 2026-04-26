import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Role } from '../../roles/entities/role.entity';
import { AdConfiguration } from '../../settings/entities/ad-configuration.entity';

@Entity('AdGroupRoleMappings')
@Index('IX_AdGroupRoleMappings_GroupName', ['groupName'])
@Index('IX_AdGroupRoleMappings_RoleId', ['roleId'])
@Index('IX_AdGroupRoleMappings_AdSourceId', ['adSourceId'])
export class AdGroupRoleMapping {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: number;

    @Column({ type: 'varchar', length: 255 })
    groupName!: string;

    @Column({ type: 'uuid', nullable: true })
    adSourceId!: string | null;

    @ManyToOne(() => AdConfiguration, { eager: false, nullable: true, onDelete: 'NO ACTION' })
    @JoinColumn({ name: 'adSourceId' })
    adSource!: AdConfiguration | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    groupExternalId!: string | null;

    @Column({ type: 'uuid' })
    roleId!: string;

    @ManyToOne(() => Role, { eager: false, nullable: false, onDelete: 'NO ACTION' })
    @JoinColumn({ name: 'roleId' })
    role!: Role;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ type: 'uuid', nullable: true })
    createdBy!: string | null;

    @Column({ type: 'uuid', nullable: true })
    updatedBy!: string | null;
}
