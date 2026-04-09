import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Workstation } from './workstation.entity';

@Entity('WorkstationUsers')
@Index('IX_WorkstationUsers_Workstation_User', ['workstationId', 'userId'], { unique: true })
@Index('IX_WorkstationUsers_UserId', ['userId'])
export class WorkstationUser extends BaseEntity {
    @Column({ type: 'uniqueidentifier' })
    workstationId!: string;

    @Column({ type: 'uniqueidentifier' })
    userId!: string;

    @ManyToOne(() => Workstation)
    @JoinColumn({ name: 'workstationId' })
    workstation!: Workstation;
}
