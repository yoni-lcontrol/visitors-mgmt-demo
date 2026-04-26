import { Entity, Column, ManyToOne, JoinColumn, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Visit } from './visit.entity';
import { Visitor } from './visitor.entity';
import { VisitorAccessLog } from './visitor-access-log.entity';
import { VisitVisitorStatus } from './visit-visitor-status.entity';

@Entity('VisitVisitors')
export class VisitVisitor extends BaseEntity {
    @Column({ type: 'uniqueidentifier' })
    visitId!: string;

    @Column({ type: 'uniqueidentifier' })
    visitorId!: string;

    @Column({ type: 'nvarchar', length: 1000, nullable: true })
    notes!: string | null;

    @ManyToOne(() => Visit, (v) => v.visitVisitors, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'visitId' })
    visit!: Visit;

    @ManyToOne(() => Visitor, { onDelete: 'NO ACTION' })
    @JoinColumn({ name: 'visitorId' })
    visitor!: Visitor;

    @OneToMany(() => VisitorAccessLog, (log) => log.visitVisitor)
    accessLogs!: VisitorAccessLog[];

    @OneToOne(() => VisitVisitorStatus, (s) => s.visitVisitor)
    status!: VisitVisitorStatus;
}
