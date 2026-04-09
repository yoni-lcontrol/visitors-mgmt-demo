import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Door } from './door.entity';

@Entity('DoorIOs')
export class DoorIo extends BaseEntity {
    @Column({ type: 'uniqueidentifier' })
    doorId!: string;

    @Column({ type: 'int', default: 0 })
    type!: number;

    @Column({ type: 'nvarchar', length: 200 })
    name!: string;

    @Column({ type: 'int', default: 0 })
    ioIndex!: number;

    @Column({ type: 'int', default: 0 })
    ioState!: number;

    @Column({ type: 'nvarchar', length: 200, nullable: true })
    externalId!: string | null;

    @ManyToOne(() => Door, (door) => door.doorIos, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'doorId' })
    door!: Door;
}
