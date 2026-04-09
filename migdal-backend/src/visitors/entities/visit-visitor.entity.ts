import { Entity, Column, ManyToOne, JoinColumn, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Visit } from './visit.entity';
import { Visitor } from './visitor.entity';
import { VisitorAccessLog } from './visitor-access-log.entity';
import { VisitVisitorStatus } from './visit-visitor-status.entity';
import { AccessLevel } from '../../access-control/entities/access-level.entity';

@Entity('VisitVisitors')
export class VisitVisitor extends BaseEntity {
    @Column({ type: 'uniqueidentifier' })
    visitId!: string;

    @Column({ type: 'uniqueidentifier' })
    visitorId!: string;

    @Column({ type: 'uniqueidentifier', nullable: true })
    accessLevelId!: string | null;

    @Column({ type: 'nvarchar', length: 1000, nullable: true })
    notes!: string | null;

    @ManyToOne(() => Visit, (v) => v.visitVisitors, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'visitId' })
    visit!: Visit;

    @ManyToOne(() => Visitor, { onDelete: 'NO ACTION' })
    @JoinColumn({ name: 'visitorId' })
    visitor!: Visitor;

    @ManyToOne(() => AccessLevel, { onDelete: 'NO ACTION' })
    @JoinColumn({ name: 'accessLevelId' })
    accessLevel!: AccessLevel;

    @OneToMany(() => VisitorAccessLog, (log) => log.visitVisitor)
    accessLogs!: VisitorAccessLog[];

    @OneToOne(() => VisitVisitorStatus, (s) => s.visitVisitor)
    status!: VisitVisitorStatus;
}
