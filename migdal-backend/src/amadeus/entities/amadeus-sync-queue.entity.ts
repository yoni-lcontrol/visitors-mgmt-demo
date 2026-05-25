import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum SyncQueueOperation {
    CreateCardholder = 'create_cardholder',
    UpdateCardholder = 'update_cardholder',
    DeleteCardholder = 'delete_cardholder',
}

export enum SyncQueueStatus {
    Pending = 'pending',
    InProgress = 'in_progress',
    Completed = 'completed',
    Failed = 'failed',
    Cancelled = 'cancelled',
}

export enum SyncQueueSource {
    CardholderCrud = 'cardholder_crud',
    VisitorCheckIn = 'visitor_check_in',
    ParkingApproval = 'parking_approval',
}

@Entity('AmadeusSyncQueue')
@Index(['status', 'nextRetryAt'])
export class AmadeusSyncQueue extends BaseEntity {
    @Column({ type: 'nvarchar', length: 30 })
    operation!: SyncQueueOperation;

    @Column({ type: 'nvarchar', length: 30 })
    source!: SyncQueueSource;

    @Column({ type: 'nvarchar', length: 20, default: SyncQueueStatus.Pending })
    status!: SyncQueueStatus;

    @Column({ type: 'nvarchar', length: 'MAX' })
    payload!: string;

    @Column({ type: 'nvarchar', length: 100, nullable: true })
    personId!: string | null;

    @Column({ type: 'nvarchar', length: 100, nullable: true })
    cardholderId!: string | null;

    @Column({ type: 'nvarchar', length: 500, nullable: true })
    errorMessage!: string | null;

    @Column({ type: 'int', default: 0 })
    retryCount!: number;

    @Column({ type: 'int', default: 10 })
    maxRetries!: number;

    @Column({ type: 'datetime2', nullable: true })
    nextRetryAt!: Date | null;

    @Column({ type: 'datetime2', nullable: true })
    completedAt!: Date | null;

    @Column({ type: 'nvarchar', length: 500, nullable: true })
    referenceId!: string | null;

    @Column({ type: 'nvarchar', length: 100, nullable: true })
    referenceType!: string | null;
}
