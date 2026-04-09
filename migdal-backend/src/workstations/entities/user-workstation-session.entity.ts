import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Workstation } from '../../workstations/entities/workstation.entity';

@Entity('UserWorkstationSessions')
@Index('IX_UserWorkstationSessions_UserId', ['userId'])
@Index('IX_UserWorkstationSessions_Workstation', ['workstationId'])
export class UserWorkstationSession extends BaseEntity {
    @Column({ type: 'uniqueidentifier' })
    userId!: string;

    @Column({ type: 'uniqueidentifier' })
    workstationId!: string;

    @Column({ type: 'nvarchar', length: 255 })
    userSocketId!: string;

    @Column({ type: 'nvarchar', length: 255, nullable: true })
    sessionId!: string | null;

    @Column({ type: 'datetime2' })
    connectedAt!: Date;

    @Column({ type: 'datetime2' })
    lastSeenAt!: Date;

    @Column({ type: 'datetime2', nullable: true })
    disconnectedAt!: Date | null;

    @ManyToOne(() => Workstation)
    @JoinColumn({ name: 'workstationId' })
    workstation!: Workstation;
}
