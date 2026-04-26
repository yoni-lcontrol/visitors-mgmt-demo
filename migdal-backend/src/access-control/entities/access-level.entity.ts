import { Entity, Column, ManyToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Building } from '../../buildings/entities/building.entity';

@Entity('AccessLevels')
export class AccessLevel extends BaseEntity {
    @Column({ type: 'nvarchar', length: 200 })
    name!: string;

    @Column({ type: 'bit', default: true })
    active!: boolean;

    @Column({ type: 'bit', default: false })
    visitorAccess!: boolean;

    @Column({ type: 'nvarchar', length: 200, nullable: true, unique: true })
    externalId!: string | null;

    @ManyToMany(() => Building, (building) => building.accessLevels)
    buildings!: Building[];
}
