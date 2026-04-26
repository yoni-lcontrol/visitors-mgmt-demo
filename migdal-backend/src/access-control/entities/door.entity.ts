import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { AcController } from './ac-controller.entity';
import { DoorIo } from './door-io.entity';

@Entity('Doors')
export class Door extends BaseEntity {
    @Column({ type: 'uniqueidentifier' })
    controllerId!: string;

    @Column({ type: 'int', default: 0 })
    doorsIndex!: number;

    @Column({ type: 'nvarchar', length: 200 })
    name!: string;

    @Column({ type: 'int', default: 0 })
    entryType!: number;

    @Column({ type: 'nvarchar', length: 200, nullable: true, unique: true })
    externalId!: string | null;

    @Column({ type: 'uniqueidentifier', nullable: true })
    stationId!: string | null;

    @ManyToOne(() => AcController, (controller) => controller.doors, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'controllerId' })
    controller!: AcController;

    @OneToMany(() => DoorIo, (doorIo) => doorIo.door, { cascade: true })
    doorIos!: DoorIo[];
}
