import { Entity, Column, ManyToMany, JoinTable, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

@Entity('Blacklist')
export class BlacklistEntry extends BaseEntity {
    @Column({ type: 'nvarchar', length: 100, nullable: true })
    firstName!: string | null;

    @Column({ type: 'nvarchar', length: 100, nullable: true })
    lastName!: string | null;

    @Column({ type: 'nvarchar', length: 50, nullable: true })
    idNumber!: string | null;

    @Column({ type: 'nvarchar', length: 50, nullable: true })
    phoneNumber!: string | null;

    @Column({ type: 'nvarchar', length: 500 })
    reason!: string;

    @Column({ type: 'datetime2', default: () => 'GETUTCDATE()' })
    blockedAt!: Date;

    @Column({ type: 'datetime2', nullable: true })
    blockedUntil!: Date | null;

    @Column({ type: 'nvarchar', length: 1000, nullable: true })
    notes!: string | null;

    @ManyToMany(() => User, { eager: false })
    @JoinTable({
        name: 'BlacklistNotifyUsers',
        joinColumn: { name: 'blacklistId', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'userId', referencedColumnName: 'id' },
    })
    notifyUsers!: User[];

    @ManyToOne(() => User, { eager: false, nullable: true })
    @JoinColumn({ name: 'createdBy' })
    createdByUser!: User | null;
}
