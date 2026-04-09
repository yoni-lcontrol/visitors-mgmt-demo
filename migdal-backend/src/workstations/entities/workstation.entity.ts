import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { CardTemplate } from '../../settings/entities/card-template.entity';

@Entity('Workstations')
export class Workstation extends BaseEntity {
    @Index('IX_Workstations_Code', { unique: true })
    @Column({ type: 'nvarchar', length: 100 })
    code!: string;

    @Column({ type: 'nvarchar', length: 255 })
    displayName!: string;

    @Column({ type: 'nvarchar', length: 500, nullable: true })
    description!: string | null;

    @Index('IX_Workstations_MachineId', { unique: true, where: 'machineId IS NOT NULL' })
    @Column({ type: 'nvarchar', length: 255, nullable: true })
    machineId!: string | null;

    @Column({ type: 'nvarchar', length: 255, nullable: true })
    hostname!: string | null;

    @Column({ type: 'nvarchar', length: 255, nullable: true })
    siteId!: string | null;

    @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
    metadataJson!: string | null;

    @Column({ type: 'uniqueidentifier', nullable: true })
    defaultCardTemplateId!: string | null;

    @ManyToOne(() => CardTemplate, { nullable: true, eager: false })
    @JoinColumn({ name: 'defaultCardTemplateId' })
    defaultCardTemplate!: CardTemplate | null;
}
