import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('Sectors')
export class Sector extends BaseEntity {
    @Column({ type: 'nvarchar', length: 200, unique: true })
    name!: string;
}
