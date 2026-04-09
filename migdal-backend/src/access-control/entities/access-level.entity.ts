import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('AccessLevels')
export class AccessLevel extends BaseEntity {
    @Column({ type: 'nvarchar', length: 200 })
    name!: string;

    @Column({ type: 'bit', default: true })
    active!: boolean;

    @Column({ type: 'bit', default: false })
    visitorAccess!: boolean;
}
