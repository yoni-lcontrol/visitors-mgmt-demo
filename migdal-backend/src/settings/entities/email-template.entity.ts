import { Entity, Column, Unique } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('EmailTemplates')
@Unique(['event', 'targetGroup'])
export class EmailTemplate extends BaseEntity {
    @Column({ type: 'nvarchar', length: 50 })
    event!: string;

    @Column({ type: 'nvarchar', length: 50 })
    targetGroup!: string;

    @Column({ type: 'nvarchar', length: 255 })
    subject!: string;

    @Column({ type: 'nvarchar', length: 'MAX' })
    bodyHtml!: string;

    @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
    recipients!: string | null;
}
