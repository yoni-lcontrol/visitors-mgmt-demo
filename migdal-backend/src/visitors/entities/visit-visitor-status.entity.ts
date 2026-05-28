import { Entity, Column, PrimaryColumn, OneToOne, JoinColumn } from 'typeorm';
import { VisitVisitor } from './visit-visitor.entity';

@Entity('VisitVisitorStatus')
export class VisitVisitorStatus {
    @PrimaryColumn({ type: 'uniqueidentifier' })
    visitVisitorId!: string;

    @Column({ type: 'uniqueidentifier' })
    visitId!: string;

    @Column({ type: 'uniqueidentifier' })
    visitorId!: string;

    @Column({ type: 'int', default: 0 })
    currentStatus!: number;

    @Column({ type: 'bigint', nullable: true })
    lastAccessLogId!: number | null;

    @Column({ type: 'datetime2', nullable: true })
    lastEventTimeUtc!: Date | null;

    @Column({ type: 'datetime2', nullable: true })
    arrivedAtUtc!: Date | null;

    @Column({ type: 'datetime2', nullable: true })
    checkedInAtUtc!: Date | null;

    @Column({ type: 'datetime2', nullable: true })
    checkedOutAtUtc!: Date | null;

    @Column({ type: 'datetime2', nullable: true })
    overstayAlertSentAtUtc!: Date | null;

    @Column({ type: 'datetime2', default: () => 'GETDATE()' })
    updatedAt!: Date;

    @OneToOne(() => VisitVisitor, (vv) => vv.status, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'visitVisitorId' })
    visitVisitor!: VisitVisitor;
}
