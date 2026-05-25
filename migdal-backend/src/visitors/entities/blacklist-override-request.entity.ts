import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { VisitVisitor } from './visit-visitor.entity';
import { User } from '../../users/entities/user.entity';
import { BlacklistEntry } from './blacklist.entity';
import { BlacklistOverrideStatus } from '../enums/blacklist-override-status.enum';

@Entity('BlacklistOverrideRequests')
export class BlacklistOverrideRequest extends BaseEntity {
    @Column({ type: 'uniqueidentifier' })
    visitVisitorId!: string;

    @Column({ type: 'uniqueidentifier', nullable: true })
    blacklistId!: string | null;

    @Column({ type: 'nvarchar', length: 500, nullable: true })
    blacklistReason!: string | null;

    @Column({ type: 'nvarchar', length: 20, default: BlacklistOverrideStatus.Pending })
    status!: BlacklistOverrideStatus;

    @Column({ type: 'uniqueidentifier', nullable: true })
    reviewedByUserId!: string | null;

    @Column({ type: 'datetime2', nullable: true })
    reviewedAt!: Date | null;

    @Column({ type: 'nvarchar', length: 500, nullable: true })
    reviewNote!: string | null;

    @ManyToOne(() => VisitVisitor, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'visitVisitorId' })
    visitVisitor!: VisitVisitor;

    @ManyToOne(() => User, { nullable: true, onDelete: 'NO ACTION' })
    @JoinColumn({ name: 'reviewedByUserId' })
    reviewedByUser!: User | null;

    @ManyToOne(() => BlacklistEntry, { nullable: true, onDelete: 'NO ACTION' })
    @JoinColumn({ name: 'blacklistId' })
    blacklistEntry!: BlacklistEntry | null;
}
