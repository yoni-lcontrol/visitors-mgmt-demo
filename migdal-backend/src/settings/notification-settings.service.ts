import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationSetting } from './entities/notification-setting.entity';
import { UpsertNotificationSettingDto } from './dto/upsert-notification-setting.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class NotificationSettingsService {
    constructor(
        @InjectRepository(NotificationSetting)
        private readonly repo: Repository<NotificationSetting>,
        private readonly auditService: AuditService,
    ) { }

    async findAll(): Promise<NotificationSetting[]> {
        return this.repo.find({
            where: { isActive: true },
            order: { targetGroup: 'ASC', event: 'ASC', channel: 'ASC' },
        });
    }

    async bulkUpsert(
        items: UpsertNotificationSettingDto[],
        currentUserId?: string,
    ): Promise<NotificationSetting[]> {
        const changes: { targetGroup: string; event: string; channel: string; enabled: boolean }[] = [];

        for (const item of items) {
            const existing = await this.repo.findOne({
                where: {
                    targetGroup: item.targetGroup,
                    event: item.event,
                    channel: item.channel,
                },
            });

            if (existing) {
                existing.enabled = item.enabled;
                existing.isActive = true;
                existing.updatedBy = currentUserId ?? null;
                await this.repo.save(existing);
            } else {
                const entity = this.repo.create({
                    ...item,
                    createdBy: currentUserId ?? null,
                    updatedBy: currentUserId ?? null,
                });
                await this.repo.save(entity);
            }
            changes.push({ targetGroup: item.targetGroup, event: item.event, channel: item.channel, enabled: item.enabled });
        }

        this.auditService.log({
            userId: currentUserId,
            module: 'settings',
            action: 'BULK_UPSERT',
            entity: 'NotificationSetting',
            description: `Bulk upserted ${items.length} notification settings`,
            newValue: changes,
        }).catch(() => { });

        return this.findAll();
    }

    async isEnabled(
        targetGroup: string,
        event: string,
        channel: string,
    ): Promise<boolean> {
        const setting = await this.repo.findOne({
            where: { targetGroup, event, channel, isActive: true },
        });
        return setting?.enabled ?? false;
    }
}
