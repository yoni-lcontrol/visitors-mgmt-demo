import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('AuditLogs')
export class AuditLog {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uniqueidentifier', nullable: true })
    userId!: string | null;

    @Column({ type: 'nvarchar', length: 100, nullable: true })
    module!: string | null;

    @Column({ type: 'nvarchar', length: 100 })
    action!: string;

    @Column({ type: 'nvarchar', length: 100 })
    entity!: string;

    @Column({ type: 'uniqueidentifier', nullable: true })
    entityId!: string | null;

    @Column({ type: 'nvarchar', length: 500, nullable: true })
    description!: string | null;

    @Column({ type: 'nvarchar', length: 255, nullable: true })
    performedByEmail!: string | null;

    @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
    oldValue!: string | null;

    @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
    newValue!: string | null;

    @Column({ type: 'nvarchar', length: 45, nullable: true })
    ipAddress!: string | null;

    @Column({ type: 'nvarchar', length: 500, nullable: true })
    userAgent!: string | null;

    @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
    metadata!: string | null;

    @CreateDateColumn({ type: 'datetime2' })
    createdAt!: Date;

    @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'userId' })
    user!: User | null;
}
