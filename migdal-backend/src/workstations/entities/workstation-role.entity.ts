import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Workstation } from './workstation.entity';

@Entity('WorkstationRoles')
@Index('IX_WorkstationRoles_Workstation_Role', ['workstationId', 'roleId'], { unique: true })
@Index('IX_WorkstationRoles_RoleId', ['roleId'])
export class WorkstationRole extends BaseEntity {
    @Column({ type: 'uniqueidentifier' })
    workstationId!: string;

    @Column({ type: 'uniqueidentifier' })
    roleId!: string;

    @ManyToOne(() => Workstation)
    @JoinColumn({ name: 'workstationId' })
    workstation!: Workstation;
}
