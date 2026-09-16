import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Visit } from './visit.entity';
import { User } from '../../users/entities/user.entity';

@Entity('VisitEscorts')
export class VisitEscort extends BaseEntity {
    @Column({ type: 'uniqueidentifier' })
    visitId!: string;

    @Column({ type: 'nvarchar', length: 200 })
    firstName!: string;

    @Column({ type: 'nvarchar', length: 200 })
    lastName!: string;

    @Column({ type: 'nvarchar', length: 50 })
    phone!: string;

    @Column({ type: 'nvarchar', length: 320 })
    email!: string;

    @Column({ type: 'nvarchar', length: 200, nullable: true })
    sector!: string | null;

    // Links this ad-hoc escort record to a real system user, when known — required
    // for badge-based escort/guest pairing at forEscort doors to recognize this
    // person as the escort invited on this specific visit.
    @Column({ type: 'uniqueidentifier', nullable: true })
    userId!: string | null;

    @ManyToOne(() => Visit, (v) => v.visitEscorts, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'visitId' })
    visit!: Visit;

    @ManyToOne(() => User, { nullable: true, onDelete: 'NO ACTION' })
    @JoinColumn({ name: 'userId' })
    user!: User | null;
}
