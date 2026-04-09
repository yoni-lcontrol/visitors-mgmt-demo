import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Workstation } from './workstation.entity';

@Entity('WorkstationEnrollmentTokens')
@Index('IX_WorkstationEnrollmentTokens_TokenHash', ['tokenHash'], { unique: true })
@Index('IX_WorkstationEnrollmentTokens_Workstation', ['workstationId'])
export class WorkstationEnrollmentToken extends BaseEntity {
    @Column({ type: 'uniqueidentifier' })
    workstationId!: string;

    @Column({ type: 'nvarchar', length: 255 })
    tokenHash!: string;

    @Column({ type: 'nvarchar', length: 50 })
    providerType!: string;

    @Column({ type: 'datetime2' })
    expiresAt!: Date;

    @Column({ type: 'bit', default: false })
    isUsed!: boolean;

    @Column({ type: 'datetime2', nullable: true })
    usedAt!: Date | null;

    @Column({ type: 'uniqueidentifier', nullable: true })
    usedByAgentId!: string | null;

    @ManyToOne(() => Workstation)
    @JoinColumn({ name: 'workstationId' })
    workstation!: Workstation;
}
