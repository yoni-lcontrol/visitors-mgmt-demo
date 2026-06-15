import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

@Entity('UserBadges')
@Index(['amadeusCardUid'], { unique: true })
@Index(['userId'])
@Index(['cardholderIdNumber'])
@Index(['cardNumber'])
export class UserBadge extends BaseEntity {
    @Column({ type: 'uniqueidentifier' })
    userId!: string;

    @ManyToOne(() => User, { eager: false, nullable: false })
    @JoinColumn({ name: 'userId' })
    user!: User;

    @Column({ type: 'nvarchar', length: 256 })
    amadeusCardUid!: string;

    @Column({ type: 'nvarchar', length: 256, nullable: true })
    cardNumber!: string | null;

    @Column({ type: 'nvarchar', length: 256, nullable: true })
    cardholderIdNumber!: string | null;

    @Column({ type: 'nvarchar', length: 256, nullable: true })
    amadeusCardholderUid!: string | null;

    @Column({ type: 'nvarchar', length: 50, nullable: true })
    status!: string | null;

    @Column({ type: 'datetime2', nullable: true })
    validFrom!: Date | null;

    @Column({ type: 'datetime2', nullable: true })
    validTo!: Date | null;

    @Column({ type: 'datetime2', nullable: true })
    lastSyncedAt!: Date | null;
}
