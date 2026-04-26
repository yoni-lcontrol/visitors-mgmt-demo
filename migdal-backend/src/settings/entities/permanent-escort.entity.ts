import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

@Entity('PermanentEscorts')
export class PermanentEscort extends BaseEntity {
    @Column({ type: 'uniqueidentifier', unique: true })
    userId!: string;

    @ManyToOne(() => User, { nullable: false })
    @JoinColumn({ name: 'userId' })
    user!: User;
}
