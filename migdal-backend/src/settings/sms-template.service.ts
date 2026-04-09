import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SmsTemplate } from './entities/sms-template.entity';
import { UpsertSmsTemplateDto } from './dto/upsert-sms-template.dto';
import { SmsTemplateRendererService } from './sms-template-renderer.service';
import { SmsProviderService } from './sms-provider.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SmsTemplateService {
    constructor(
        @InjectRepository(SmsTemplate)
        private readonly repo: Repository<SmsTemplate>,
        private readonly renderer: SmsTemplateRendererService,
        private readonly provider: SmsProviderService,
        private readonly auditService: AuditService,
    ) { }

    async findAll(): Promise<SmsTemplate[]> {
        return this.repo.find({
            where: { isActive: true },
            order: { targetGroup: 'ASC', event: 'ASC' },
        });
    }

    async bulkUpsert(
        items: UpsertSmsTemplateDto[],
        currentUserId?: string,
    ): Promise<SmsTemplate[]> {
        const changes: { event: string; targetGroup: string; action: string }[] = [];

        for (const item of items) {
            // Validate template placeholders
            this.renderer.validateTemplate(item.template);

            const existing = await this.repo.findOne({
                where: { event: item.event, targetGroup: item.targetGroup },
            });

            if (existing) {
                existing.template = item.template;
                existing.recipients = item.recipients ? JSON.stringify(item.recipients) : null;
                existing.isActive = true;
                existing.updatedBy = currentUserId ?? null;
                await this.repo.save(existing);
                changes.push({ event: item.event, targetGroup: item.targetGroup, action: 'updated' });
            } else {
                const entity = this.repo.create({
                    event: item.event,
                    targetGroup: item.targetGroup,
                    template: item.template,
                    recipients: item.recipients ? JSON.stringify(item.recipients) : null,
                    createdBy: currentUserId ?? null,
                    updatedBy: currentUserId ?? null,
                });
                await this.repo.save(entity);
                changes.push({ event: item.event, targetGroup: item.targetGroup, action: 'created' });
            }
        }

        this.auditService.log({
            userId: currentUserId,
            module: 'settings',
            action: 'BULK_UPSERT',
            entity: 'SmsTemplate',
            description: `Bulk upserted ${items.length} SMS templates`,
            newValue: changes,
        }).catch(() => { });

        return this.findAll();
    }

    async preview(event: string, customTemplate?: string, targetGroup?: string): Promise<{ rendered: string; placeholders: string[] }> {
        let template = customTemplate;
        if (!template) {
            const where: Record<string, unknown> = { event, isActive: true };
            if (targetGroup) where['targetGroup'] = targetGroup;
            const entity = await this.repo.findOne({ where });
            template = entity?.template ?? '';
        }

        this.renderer.validateTemplate(template);
        const sampleData = this.renderer.getSampleData();
        const rendered = this.renderer.render(template, sampleData);

        return {
            rendered,
            placeholders: this.renderer.getSupportedPlaceholders(),
        };
    }

    async testSms(phone: string, template: string): Promise<{ success: boolean; message: string }> {
        if (!this.provider.isConfigured()) {
            throw new BadRequestException('SMS provider is not configured');
        }

        this.renderer.validateTemplate(template);
        const sampleData = this.renderer.getSampleData();
        const message = this.renderer.render(template, sampleData);
        const result = await this.provider.send({ to: phone, message });

        if (!result.success) {
            throw new BadRequestException(result.error ?? 'Failed to send test SMS');
        }

        return { success: true, message };
    }
}
