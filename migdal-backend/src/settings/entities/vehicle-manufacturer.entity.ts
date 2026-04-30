import { Entity, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('VehicleManufacturers')
export class VehicleManufacturer {
    @PrimaryColumn({ type: 'nvarchar', length: 120 })
    name!: string;

    @CreateDateColumn({ type: 'datetime2' })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'datetime2' })
    updatedAt!: Date;
}
