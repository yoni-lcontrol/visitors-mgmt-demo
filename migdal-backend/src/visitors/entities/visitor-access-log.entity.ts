import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { VisitVisitor } from './visit-visitor.entity';

@Entity('VisitorAccessLogs')
export class VisitorAccessLog {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    logId!: number;

    @Column({ type: 'uniqueidentifier' })
    visitVisitorId!: string;

    @Column({ type: 'uniqueidentifier' })
    visitId!: string;

    @Column({ type: 'uniqueidentifier' })
    visitorId!: string;

    @Column({ type: 'nvarchar', length: 100, nullable: true })
    siteId!: string | null;

    @Column({ type: 'int' })
    eventType!: number;

    @Column({ type: 'datetime2', default: () => 'GETUTCDATE()' })
    eventTimeUtc!: Date;

    @Column({ type: 'nvarchar', length: 100, nullable: true })
    deviceId!: string | null;

    @Column({ type: 'nvarchar', length: 100, nullable: true })
    gateId!: string | null;

    @Column({ type: 'nvarchar', length: 100, nullable: true })
    readerId!: string | null;

    @Column({ type: 'nvarchar', length: 50, nullable: true })
    source!: string | null;

    @Column({ type: 'uniqueidentifier', nullable: true })
    createdByUserId!: string | null;

    @Column({ type: 'nvarchar', length: 1000, nullable: true })
    notes!: string | null;

    @Column({ type: 'datetime2', default: () => 'GETDATE()' })
    createdAt!: Date;

    @ManyToOne(() => VisitVisitor, (vv) => vv.accessLogs, { onDelete: 'NO ACTION' })
    @JoinColumn({ name: 'visitVisitorId' })
    visitVisitor!: VisitVisitor;
}
