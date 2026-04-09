import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SmsTemplate } from './entities/sms-template.entity';
import { SmsTemplateRendererService, SmsTemplateData } from './sms-template-renderer.service';
import { SmsProviderService, SmsSendResult } from './sms-provider.service';
import { NotificationSettingsService } from './notification-settings.service';
import { AuditService } from '../audit/audit.service';
import { NotificationEvent } from './enums/notification-event.enum';

@Injectable()
export class SmsNotificationService {
    private readonly logger = new Logger(SmsNotificationService.name);

    constructor(
        @InjectRepository(SmsTemplate)
        private readonly templateRepo: Repository<SmsTemplate>,
        private readonly renderer: SmsTemplateRendererService,
        private readonly provider: SmsProviderService,
        private readonly notificationSettings: NotificationSettingsService,
        private readonly auditService: AuditService,
    ) { }

    /**
     * Entry point: trigger SMS for a notification event.
     * Sends per target group using group-specific templates.
     * Never throws — failures are logged and audited.
     */
    async triggerSms(event: NotificationEvent, data: SmsTemplateData): Promise<void> {
        try {
            // 1. Check if SMS provider is configured at all
            if (!this.provider.isConfigured()) {
                this.logger.debug(`SMS provider not configured, skipping event ${event}`);
                return;
            }

            const targetGroups = ['system_users', 'visitors', 'escorts', 'visit_requester'];
            const allResults: SmsSendResult[] = [];

            for (const group of targetGroups) {
                // 2. Check if SMS is enabled for this target group
                const enabled = await this.notificationSettings.isEnabled(group, event, 'sms');
                if (!enabled) continue;

                // 3. Load the template for this event + target group
                const smsTemplate = await this.templateRepo.findOne({
                    where: { event, targetGroup: group, isActive: true },
                });
                if (!smsTemplate) {
                    this.logger.debug(`No SMS template found for event ${event}, group ${group}`);
                    continue;
                }

                // 4. Resolve recipients
                const recipients = this.parseRecipients(smsTemplate.recipients);
                if (recipients.length === 0) continue;

                // 5. Render the message
                const message = this.renderer.render(smsTemplate.template, data);

                // 6. Send to all recipients
                const results = await this.provider.sendBulk(
                    recipients.map((to) => ({ to, message })),
                );
                allResults.push(...results);
            }

            // 7. Log results
            if (allResults.length > 0) {
                await this.logResults(event, allResults);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            this.logger.error(`SMS notification failed for event ${event}: ${message}`);
            this.auditService.log({
                module: 'notifications',
                action: 'SMS_SEND_ERROR',
                entity: 'SmsNotification',
                oldValue: { event },
                newValue: { error: message },
            }).catch(() => { });
        }
    }

    private parseRecipients(recipientsJson: string | null): string[] {
        if (!recipientsJson) return [];
        try {
            const parsed = JSON.parse(recipientsJson);
            if (Array.isArray(parsed)) return parsed.filter((r) => typeof r === 'string' && r.trim());
            return [];
        } catch {
            return [];
        }
    }

    private async logResults(event: string, results: SmsSendResult[]): Promise<void> {
        const succeeded = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success).length;

        if (failed > 0) {
            const errors = results
                .filter((r) => !r.success)
                .map((r) => `${r.to}: ${r.error}`);
            this.logger.warn(`SMS event ${event}: ${succeeded} sent, ${failed} failed. Errors: ${errors.join('; ')}`);
        } else {
            this.logger.log(`SMS event ${event}: ${succeeded} sent successfully`);
        }

        this.auditService.log({
            module: 'notifications',
            action: 'SMS_SENT',
            entity: 'SmsNotification',
            newValue: { event, succeeded, failed, total: results.length },
        }).catch(() => { });
    }
}
