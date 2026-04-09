import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { VisitVisitor } from './visit-visitor.entity';
import { Visit } from './visit.entity';
import { Visitor } from './visitor.entity';

@Entity('VisitVisitorCheckInCodes')
export class VisitVisitorCheckInCode extends BaseEntity {
    @Column({ type: 'uniqueidentifier' })
    visitVisitorId!: string;

    @Column({ type: 'uniqueidentifier' })
    visitId!: string;

    @Column({ type: 'uniqueidentifier' })
    visitorId!: string;

    @Column({ type: 'nvarchar', length: 6 })
    code!: string;

    @Column({ type: 'datetime2' })
    validFromUtc!: Date;

    @Column({ type: 'datetime2' })
    validToUtc!: Date;

    @Column({ type: 'datetime2', nullable: true })
    usedAtUtc!: Date | null;

    @Column({ type: 'bit', default: false })
    sentBySms!: boolean;

    @Column({ type: 'bit', default: false })
    sentByEmail!: boolean;

    @Column({ type: 'datetime2', nullable: true })
    lastSentAtUtc!: Date | null;

    @ManyToOne(() => VisitVisitor, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'visitVisitorId' })
    visitVisitor!: VisitVisitor;

    @ManyToOne(() => Visit, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'visitId' })
    visit!: Visit;

    @ManyToOne(() => Visitor, { onDelete: 'NO ACTION' })
    @JoinColumn({ name: 'visitorId' })
    visitor!: Visitor;
}
