import { Injectable, Logger } from '@nestjs/common';
import { EmailTemplateService } from './email-template.service';
import { EmailTemplateRendererService, EmailTemplateData } from './email-template-renderer.service';
import { EmailProviderService, EmailSendResult } from './email-provider.service';
import { NotificationSettingsService } from './notification-settings.service';
import { AuditService } from '../audit/audit.service';
import { NotificationEvent } from './enums/notification-event.enum';

@Injectable()
export class EmailNotificationService {
    private readonly logger = new Logger(EmailNotificationService.name);

    constructor(
        private readonly templateService: EmailTemplateService,
        private readonly renderer: EmailTemplateRendererService,
        private readonly provider: EmailProviderService,
        private readonly notificationSettings: NotificationSettingsService,
        private readonly auditService: AuditService,
    ) { }

    /**
     * Trigger email for a notification event.
     * Sends per target group using group-specific templates.
     * Never throws — failures are logged and audited.
     */
    async triggerEmail(event: NotificationEvent, data: EmailTemplateData): Promise<void> {
        try {
            // 1. Check if email provider is configured
            if (!this.provider.isConfigured()) {
                this.logger.debug(`Email provider not configured, skipping event ${event}`);
                return;
            }

            const targetGroups = ['system_users', 'visitors', 'escorts', 'visit_requester'];
            const allResults: EmailSendResult[] = [];

            for (const group of targetGroups) {
                // 2. Check if email is enabled for this target group
                const enabled = await this.notificationSettings.isEnabled(group, event, 'email');
                if (!enabled) continue;

                // 3. Load the template for this event + target group
                const emailTemplate = await this.templateService.loadTemplate(event, group);
                if (!emailTemplate) {
                    this.logger.debug(`No email template found for event ${event}, group ${group}`);
                    continue;
                }

                // 4. Resolve recipients
                const recipients = this.parseRecipients(emailTemplate.recipients);
                if (recipients.length === 0) continue;

                // 5. Render subject and body
                const subject = this.renderer.render(emailTemplate.subject, data);
                const html = this.renderer.render(emailTemplate.bodyHtml, data);

                // 6. Send to all recipients
                const results = await this.provider.sendBulk(
                    recipients.map((to) => ({ to, subject, html })),
                );
                allResults.push(...results);
            }

            // 7. Log results
            if (allResults.length > 0) {
                await this.logResults(event, allResults);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            this.logger.error(`Email notification failed for event ${event}: ${message}`);
            this.auditService.log({
                module: 'notifications',
                action: 'EMAIL_SEND_ERROR',
                entity: 'EmailNotification',
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

    private async logResults(event: string, results: EmailSendResult[]): Promise<void> {
        const succeeded = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success).length;

        if (failed > 0) {
            const errors = results
                .filter((r) => !r.success)
                .map((r) => `${r.to}: ${r.error}`);
            this.logger.warn(`Email event ${event}: ${succeeded} sent, ${failed} failed. Errors: ${errors.join('; ')}`);
        } else {
            this.logger.log(`Email event ${event}: ${succeeded} sent successfully`);
        }

        this.auditService.log({
            module: 'notifications',
            action: 'EMAIL_SENT',
            entity: 'EmailNotification',
            newValue: { event, succeeded, failed, total: results.length },
        }).catch(() => { });
    }
}
