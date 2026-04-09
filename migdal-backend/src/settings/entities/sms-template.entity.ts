import { Entity, Column, Unique } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('SmsTemplates')
@Unique(['event', 'targetGroup'])
export class SmsTemplate extends BaseEntity {
    @Column({ type: 'nvarchar', length: 50 })
    event!: string;

    @Column({ type: 'nvarchar', length: 50 })
    targetGroup!: string;

    @Column({ type: 'nvarchar', length: 'MAX' })
    template!: string;

    @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
    recipients!: string | null;
}
