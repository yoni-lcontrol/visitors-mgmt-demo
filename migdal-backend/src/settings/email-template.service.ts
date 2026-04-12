import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailTemplate } from './entities/email-template.entity';
import { UpsertEmailTemplateDto } from './dto/upsert-email-template.dto';
import { EmailTemplateRendererService } from './email-template-renderer.service';
import { EmailProviderService } from './email-provider.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class EmailTemplateService {
    private readonly logger = new Logger(EmailTemplateService.name);

    constructor(
        @InjectRepository(EmailTemplate)
        private readonly repo: Repository<EmailTemplate>,
        private readonly renderer: EmailTemplateRendererService,
        private readonly provider: EmailProviderService,
        private readonly auditService: AuditService,
    ) { }

    async findAll(): Promise<EmailTemplate[]> {
        return this.repo.find({
            where: { isActive: true },
            order: { targetGroup: 'ASC', event: 'ASC' },
        });
    }

    async loadTemplate(event: string, targetGroup: string): Promise<EmailTemplate | null> {
        return this.repo.findOne({
            where: { event, targetGroup, isActive: true },
        });
    }

    async bulkUpsert(
        items: UpsertEmailTemplateDto[],
        currentUserId?: string,
    ): Promise<EmailTemplate[]> {
        const changes: { event: string; targetGroup: string; action: string }[] = [];

        for (const item of items) {
            this.renderer.validateTemplate(item.subject);
            this.renderer.validateTemplate(item.bodyHtml);

            const existing = await this.repo.findOne({
                where: { event: item.event, targetGroup: item.targetGroup },
            });

            if (existing) {
                existing.subject = item.subject;
                existing.bodyHtml = item.bodyHtml;
                existing.recipients = item.recipients ? JSON.stringify(item.recipients) : null;
                existing.isActive = true;
                existing.updatedBy = currentUserId ?? null;
                await this.repo.save(existing);
                changes.push({ event: item.event, targetGroup: item.targetGroup, action: 'updated' });
            } else {
                const entity = this.repo.create({
                    event: item.event,
                    targetGroup: item.targetGroup,
                    subject: item.subject,
                    bodyHtml: item.bodyHtml,
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
            entity: 'EmailTemplate',
            description: `Bulk upserted ${items.length} email templates`,
            newValue: changes,
        }).catch(() => { });

        return this.findAll();
    }

    async preview(
        event: string,
        customSubject?: string,
        customBodyHtml?: string,
        targetGroup?: string,
    ): Promise<{ renderedSubject: string; renderedBody: string; placeholders: string[] }> {
        let subject = customSubject;
        let bodyHtml = customBodyHtml;

        if (!subject || !bodyHtml) {
            const where: Record<string, unknown> = { event, isActive: true };
            if (targetGroup) where['targetGroup'] = targetGroup;
            const template = await this.repo.findOne({ where });
            subject = subject ?? template?.subject ?? '';
            bodyHtml = bodyHtml ?? template?.bodyHtml ?? '';
        }

        this.renderer.validateTemplate(subject);
        this.renderer.validateTemplate(bodyHtml);
        const sampleData = this.renderer.getSampleData();

        return {
            renderedSubject: this.renderer.render(subject, sampleData),
            renderedBody: this.renderer.render(bodyHtml, sampleData),
            placeholders: this.renderer.getSupportedPlaceholders(),
        };
    }

    async testEmail(
        email: string,
        subject: string,
        bodyHtml: string,
    ): Promise<{ success: boolean; subject: string; html: string }> {
        if (!this.provider.isConfigured()) {
            throw new BadRequestException('Email provider is not configured');
        }

        this.renderer.validateTemplate(subject);
        this.renderer.validateTemplate(bodyHtml);
        const sampleData = this.renderer.getSampleData();
        const renderedSubject = this.renderer.render(subject, sampleData);
        const html = this.renderer.render(bodyHtml, sampleData);
        const result = await this.provider.send({ to: email, subject: renderedSubject, html });

        if (!result.success) {
            throw new BadRequestException(result.error ?? 'Failed to send test email');
        }

        return { success: true, subject: renderedSubject, html };
    }
}
