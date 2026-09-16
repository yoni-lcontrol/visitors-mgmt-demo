import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Exclude } from 'class-transformer';
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

    @Exclude()
    @Column({ type: 'nvarchar', length: 200, nullable: true, unique: true })
    externalId!: string | null;

    @Column({ type: 'uniqueidentifier', nullable: true })
    stationId!: string | null;

    @Column({ type: 'bit', default: false })
    forEscort!: boolean;

    @Column({ type: 'nvarchar', length: 200, nullable: true })
    badgeReaderExternalId!: string | null;

    @Column({ type: 'nvarchar', length: 200, nullable: true })
    qrReaderExternalId!: string | null;

    @ManyToOne(() => AcController, (controller) => controller.doors, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'controllerId' })
    controller!: AcController;

    @OneToMany(() => DoorIo, (doorIo) => doorIo.door, { cascade: true })
    doorIos!: DoorIo[];
}
