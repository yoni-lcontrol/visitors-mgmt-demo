import { Entity, Column, Unique } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('NotificationSettings')
@Unique(['targetGroup', 'event', 'channel'])
export class NotificationSetting extends BaseEntity {
    @Column({ type: 'nvarchar', length: 50 })
    targetGroup!: string; // visit_creator | visitors | escorts | visit_requester

    @Column({ type: 'nvarchar', length: 50 })
    event!: string; // visit_created | visit_updated | visit_deleted | visitor_arrived_with_escort | visitor_arrived_without_escort | visitor_blacklisted | check_in_code_sent

    @Column({ type: 'nvarchar', length: 20 })
    channel!: string; // sms | email

    @Column({ type: 'bit', default: false })
    enabled!: boolean;
}
