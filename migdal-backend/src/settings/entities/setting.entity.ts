import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('Settings')
export class Setting extends BaseEntity {
    @Column({ type: 'nvarchar', length: 200, unique: true })
    key!: string;

    @Column({ type: 'nvarchar', length: 'MAX' })
    value!: string;

    @Column({ type: 'nvarchar', length: 50, default: 'string' })
    type!: string; // string, number, boolean, json

    @Column({ type: 'nvarchar', length: 100 })
    group!: string;

    @Column({ type: 'nvarchar', length: 200 })
    label!: string;

    @Column({ type: 'nvarchar', length: 500, nullable: true })
    description!: string | null;

    @Column({ type: 'bit', default: false })
    isPublic!: boolean;
}
