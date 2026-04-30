import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('VehicleModels')
@Index('UQ_VehicleModels_Manufacturer_Model', ['manufacturer', 'model'], { unique: true })
export class VehicleModel {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'nvarchar', length: 120 })
    manufacturer!: string;

    @Column({ type: 'nvarchar', length: 120 })
    model!: string;

    @CreateDateColumn({ type: 'datetime2' })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'datetime2' })
    updatedAt!: Date;

    @Column({ type: 'uniqueidentifier', nullable: true })
    createdBy!: string | null;

    @Column({ type: 'uniqueidentifier', nullable: true })
    updatedBy!: string | null;
}
