import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('AdConfigurations')
export class AdConfiguration extends BaseEntity {
    @Column({ type: 'nvarchar', length: 200 })
    name!: string;

    @Column({ type: 'nvarchar', length: 255 })
    domain!: string;

    @Column({ type: 'nvarchar', length: 500 })
    ldapUrl!: string;

    @Column({ type: 'nvarchar', length: 200, nullable: true })
    baseDn!: string | null;

    @Column({ type: 'nvarchar', length: 200 })
    username!: string;

    @Column({ type: 'nvarchar', length: 500 })
    password!: string;

    @Column({ type: 'int', default: 389 })
    port!: number;

    @Column({ type: 'bit', default: false })
    useSsl!: boolean;

    @Column({ type: 'nvarchar', length: 500, nullable: true })
    description!: string | null;
}
