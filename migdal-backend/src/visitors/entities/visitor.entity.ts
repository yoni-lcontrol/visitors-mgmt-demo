import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { VehicleType } from '../enums/vehicle-type.enum';

@Entity('Visitors')
export class Visitor extends BaseEntity {
    @Column({ type: 'nvarchar', length: 100 })
    firstName!: string;

    @Column({ type: 'nvarchar', length: 100 })
    lastName!: string;

    @Column({ type: 'nvarchar', length: 255, nullable: true })
    email!: string | null;

    @Column({ type: 'nvarchar', length: 50 })
    phone!: string;

    @Column({ type: 'nvarchar', length: 50 })
    personId!: string;

    @Column({ type: 'nvarchar', length: 50, nullable: true })
    carNumber!: string | null;

    @Column({ type: 'nvarchar', length: 20, nullable: true })
    vehicleType!: string | null;
}
