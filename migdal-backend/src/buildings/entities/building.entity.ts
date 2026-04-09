import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('Buildings')
export class Building extends BaseEntity {
    @Column({ type: 'nvarchar', length: 200 })
    name!: string;

    @Column({ type: 'nvarchar', length: 500, nullable: true })
    address!: string | null;

    @Column({ type: 'bit', default: true })
    active!: boolean;
}
