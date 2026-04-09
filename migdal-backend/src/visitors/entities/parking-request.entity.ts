import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { VisitVisitor } from './visit-visitor.entity';
import { User } from '../../users/entities/user.entity';
import { ParkingRequestStatus } from '../enums/parking-request-status.enum';

@Entity('ParkingRequests')
export class ParkingRequest extends BaseEntity {
    @Column({ type: 'uniqueidentifier' })
    visitVisitorId!: string;

    @Column({ type: 'nvarchar', length: 20, default: ParkingRequestStatus.Pending })
    status!: ParkingRequestStatus;

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
}
