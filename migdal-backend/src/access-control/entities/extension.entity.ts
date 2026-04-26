import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { AcController } from './ac-controller.entity';
import { ExtensionIo } from './extension-io.entity';

@Entity('Extensions')
export class Extension extends BaseEntity {
    @Column({ type: 'uniqueidentifier' })
    controllerId!: string;

    @Column({ type: 'int', default: 0 })
    type!: number;

    @Column({ type: 'nvarchar', length: 200 })
    name!: string;

    @Column({ type: 'int', default: 0 })
    extensionIndex!: number;

    @Column({ type: 'nvarchar', length: 200, nullable: true, unique: true })
    externalId!: string | null;

    @ManyToOne(() => AcController, (controller) => controller.extensions, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'controllerId' })
    controller!: AcController;

    @OneToMany(() => ExtensionIo, (extIo) => extIo.extension, { cascade: true })
    extensionIos!: ExtensionIo[];
}
