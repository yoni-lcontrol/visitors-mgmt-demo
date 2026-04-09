import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('CardTemplates')
export class CardTemplate extends BaseEntity {
    @Column({ type: 'nvarchar', length: 200 })
    name!: string;

    @Column({ type: 'nvarchar', length: 500, nullable: true })
    description!: string | null;

    @Column({ type: 'int', default: 54 })
    cardWidthMm!: number;

    @Column({ type: 'int', default: 86 })
    cardHeightMm!: number;

    @Column({ type: 'nvarchar', length: 20, default: 'landscape' })
    orientation!: string;

    @Column({ type: 'nvarchar', length: 'MAX' })
    elementsJson!: string;

    @Column({ type: 'nvarchar', length: 50, nullable: true })
    backgroundColor!: string | null;

    @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
    backgroundImageUrl!: string | null;
}
