import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';

@Entity('ExternalEventLogs')
@Index('IX_ExternalEventLogs_Provider_ExternalEventId', ['provider', 'externalEventId'], { unique: true, where: 'externalEventId IS NOT NULL' })
@Index('IX_ExternalEventLogs_Provider', ['provider'])
@Index('IX_ExternalEventLogs_Status', ['status'])
@Index('IX_ExternalEventLogs_ReceivedAt', ['receivedAt'])
export class ExternalEventLog {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'nvarchar', length: 50 })
    provider!: string;

    @Column({ type: 'nvarchar', length: 100 })
    clientId!: string;

    @Column({ type: 'nvarchar', length: 255, nullable: true })
    externalEventId!: string | null;

    @Column({ type: 'nvarchar', length: 100 })
    eventType!: string;

    @Column({ type: 'nvarchar', length: 'MAX' })
    payloadJson!: string;

    @Column({ type: 'nvarchar', length: 512 })
    signature!: string;

    @Column({ type: 'datetime2' })
    receivedAt!: Date;

    @Column({ type: 'datetime2', nullable: true })
    processedAt!: Date | null;

    @Column({ type: 'nvarchar', length: 20, default: "'received'" })
    status!: string;

    @Column({ type: 'nvarchar', length: 2000, nullable: true })
    errorMessage!: string | null;

    @Column({ type: 'nvarchar', length: 255, nullable: true })
    correlationId!: string | null;

    @CreateDateColumn({ type: 'datetime2' })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'datetime2' })
    updatedAt!: Date;

    @Column({ type: 'uniqueidentifier', nullable: true })
    createdBy!: string | null;

    @Column({ type: 'uniqueidentifier', nullable: true })
    updatedBy!: string | null;

    @Column({ type: 'bit', default: true })
    isActive!: boolean;
}
