import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

@Entity('RefreshTokens')
export class RefreshToken extends BaseEntity {
    @Column({ type: 'uniqueidentifier' })
    userId!: string;

    @Column({ type: 'nvarchar', length: 500, unique: true })
    tokenHash!: string;

    @Column({ type: 'datetime2' })
    expiresAt!: Date;

    @Column({ type: 'bit', default: false })
    isRevoked!: boolean;

    @Column({ type: 'nvarchar', length: 500, nullable: true })
    userAgent!: string | null;

    @Column({ type: 'nvarchar', length: 45, nullable: true })
    ipAddress!: string | null;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user!: User;
}
