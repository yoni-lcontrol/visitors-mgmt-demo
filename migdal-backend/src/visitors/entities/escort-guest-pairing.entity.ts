import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { VisitVisitor } from './visit-visitor.entity';
import { User } from '../../users/entities/user.entity';
import { Door } from '../../access-control/entities/door.entity';
import { EscortGuestPairingStatus } from '../enums/escort-guest-pairing-status.enum';

@Entity('EscortGuestPairings')
export class EscortGuestPairing extends BaseEntity {
    @Column({ type: 'uniqueidentifier' })
    visitVisitorId!: string;

    @Column({ type: 'uniqueidentifier' })
    escortUserId!: string;

    @Column({ type: 'uniqueidentifier' })
    doorId!: string;

    @Column({ type: 'nvarchar', length: 20, default: EscortGuestPairingStatus.CardActivated })
    status!: EscortGuestPairingStatus;

    @Column({ type: 'datetime2' })
    pairedAtUtc!: Date;

    @Column({ type: 'datetime2', nullable: true })
    releasedAtUtc!: Date | null;

    @ManyToOne(() => VisitVisitor, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'visitVisitorId' })
    visitVisitor!: VisitVisitor;

    @ManyToOne(() => User, { onDelete: 'NO ACTION' })
    @JoinColumn({ name: 'escortUserId' })
    escortUser!: User;

    @ManyToOne(() => Door, { onDelete: 'NO ACTION' })
    @JoinColumn({ name: 'doorId' })
    door!: Door;
}
