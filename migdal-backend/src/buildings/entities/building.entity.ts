import { Entity, Column, ManyToMany, JoinTable } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { AccessLevel } from '../../access-control/entities/access-level.entity';

@Entity('Buildings')
export class Building extends BaseEntity {
    @Column({ type: 'nvarchar', length: 200 })
    name!: string;

    @Column({ type: 'nvarchar', length: 500, nullable: true })
    address!: string | null;

    @Column({ type: 'bit', default: true })
    active!: boolean;

    @ManyToMany(() => AccessLevel)
    @JoinTable({
        name: 'BuildingAccessLevels',
        joinColumn: { name: 'buildingId', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'accessLevelId', referencedColumnName: 'id' },
    })
    accessLevels!: AccessLevel[];
}
