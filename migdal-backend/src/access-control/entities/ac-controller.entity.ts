import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Door } from './door.entity';
import { Extension } from './extension.entity';

@Entity('AcControllers')
export class AcController extends BaseEntity {
    @Column({ type: 'int', default: 0 })
    type!: number;

    @Column({ type: 'nvarchar', length: 100, nullable: true })
    model!: string | null;

    @Column({ type: 'nvarchar', length: 200 })
    name!: string;

    @Column({ type: 'nvarchar', length: 45, nullable: true })
    ip!: string | null;

    @Column({ type: 'int', default: 0 })
    port!: number;

    @Column({ type: 'nvarchar', length: 200, nullable: true })
    externalId!: string | null;

    @OneToMany(() => Door, (door) => door.controller, { cascade: true })
    doors!: Door[];

    @OneToMany(() => Extension, (extension) => extension.controller, { cascade: true })
    extensions!: Extension[];
}
