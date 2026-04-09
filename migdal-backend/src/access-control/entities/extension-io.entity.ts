import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Extension } from './extension.entity';

@Entity('ExtensionIOs')
export class ExtensionIo extends BaseEntity {
    @Column({ type: 'uniqueidentifier' })
    extensionId!: string;

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

    @ManyToOne(() => Extension, (ext) => ext.extensionIos, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'extensionId' })
    extension!: Extension;
}
