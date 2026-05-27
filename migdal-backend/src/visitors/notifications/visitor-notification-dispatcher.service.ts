import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SmsProviderService } from '../../settings/sms-provider.service';
import { EmailProviderService } from '../../settings/email-provider.service';
import { SmsTemplateRendererService } from '../../settings/sms-template-renderer.service';
import { EmailTemplateRendererService } from '../../settings/email-template-renderer.service';
import { SmsTemplate } from '../../settings/entities/sms-template.entity';
import { EmailTemplate } from '../../settings/entities/email-template.entity';
import { AuditService } from '../../audit/audit.service';
import { VISITOR_NOTIFICATION_MATRIX } from './visitor-notification-matrix';
import {
    VisitorNotificationScenario,
    VisitorNotificationRecipient,
    VisitorNotificationChannel,
    VisitorNotificationRule,
    VisitorNotificationContext,
    ResolvedRecipient,
    NotificationDispatchResult,
} from './visitor-notification.types';

@Injectable()
export class VisitorNotificationDispatcherService {
    private readonly logger = new Logger(VisitorNotificationDispatcherService.name);

    constructor(
        private readonly smsProvider: SmsProviderService,
        private readonly emailProvider: EmailProviderService,
        private readonly smsRenderer: SmsTemplateRendererService,
        private readonly emailRenderer: EmailTemplateRendererService,
        @InjectRepository(SmsTemplate)
        private readonly smsTemplateRepo: Repository<SmsTemplate>,
        @InjectRepository(EmailTemplate)
        private readonly emailTemplateRepo: Repository<EmailTemplate>,
        private readonly auditService: AuditService,
    ) {}

    /**
     * Dispatch notifications for a given scenario.
     * Finds matching rules in the matrix, resolves recipients, renders templates, and sends.
     */
    async dispatch(
        scenario: VisitorNotificationScenario,
        context: VisitorNotificationContext,
    ): Promise<NotificationDispatchResult[]> {
        const rules = this.findRules(scenario);
        if (rules.length === 0) {
            this.logger.debug(`No notification rules found for scenario: ${scenario}`);
            return [];
        }

        this.logger.log(
            `Dispatching notifications for scenario "${scenario}" — ${rules.length} rule(s) matched`,
        );

        const results: NotificationDispatchResult[] = [];

        for (const rule of rules) {
            const ruleResults = await this.processRule(rule, context);
            results.push(...ruleResults);
        }

        const succeeded = results.filter((r) => r.success).length;
        const skipped = results.filter((r) => r.skippedReason).length;
        const failed = results.filter((r) => !r.success && !r.skippedReason).length;

        this.logger.log(
            `Notification dispatch complete for "${scenario}": ${succeeded} sent, ${skipped} skipped, ${failed} failed`,
        );

        return results;
    }

    private findRules(scenario: VisitorNotificationScenario): VisitorNotificationRule[] {
        return VISITOR_NOTIFICATION_MATRIX.filter((r) => r.scenario === scenario);
    }

    private async processRule(
        rule: VisitorNotificationRule,
        context: VisitorNotificationContext,
    ): Promise<NotificationDispatchResult[]> {
        const results: NotificationDispatchResult[] = [];
        const recipient = this.resolveRecipient(rule.recipient, context);

        if (!recipient) {
            this.logger.debug(
                `Recipient "${rule.recipient}" could not be resolved for scenario "${rule.scenario}" — skipping`,
            );
            for (const channel of rule.channels) {
                results.push({
                    scenario: rule.scenario,
                    recipient: rule.recipient,
                    channel,
                    success: false,
                    skippedReason: `Recipient "${rule.recipient}" not available in context`,
                });
            }
            return results;
        }

        // Skip VisitRequester rules if creator and requester are the same person
        if (
            rule.recipient === VisitorNotificationRecipient.VisitRequester &&
            context.creator?.id &&
            context.requester?.id &&
            context.creator.id === context.requester.id
        ) {
            for (const channel of rule.channels) {
                results.push({
                    scenario: rule.scenario,
                    recipient: rule.recipient,
                    channel,
                    success: false,
                    skippedReason: 'Requester is the same as creator — no on-behalf notification needed',
                });
            }
            return results;
        }

        for (const channel of rule.channels) {
            const result = await this.sendNotification(rule, channel, recipient, context);
            results.push(result);
        }

        return results;
    }

    private resolveRecipient(
        recipientType: VisitorNotificationRecipient,
        context: VisitorNotificationContext,
    ): ResolvedRecipient | null {
        switch (recipientType) {
            case VisitorNotificationRecipient.VisitCreator:
                if (!context.creator) return null;
                return {
                    recipientType,
                    firstName: context.creator.firstName,
                    lastName: context.creator.lastName,
                    email: context.creator.email ?? undefined,
                    phone: context.creator.phone ?? undefined,
                };

            case VisitorNotificationRecipient.VisitRequester:
                if (!context.requester) return null;
                return {
                    recipientType,
                    firstName: context.requester.firstName,
                    lastName: context.requester.lastName,
                    email: context.requester.email ?? undefined,
                    phone: context.requester.phone ?? undefined,
                };

            case VisitorNotificationRecipient.Visitor:
                if (!context.visitor) return null;
                return {
                    recipientType,
                    firstName: context.visitor.firstName,
                    lastName: context.visitor.lastName,
                    email: context.visitor.email ?? undefined,
                    phone: context.visitor.phone ?? undefined,
                };

            case VisitorNotificationRecipient.Host:
                // Host = visit requester if present, otherwise creator
                if (context.requester) {
                    return {
                        recipientType,
                        firstName: context.requester.firstName,
                        lastName: context.requester.lastName,
                        email: context.requester.email ?? undefined,
                        phone: context.requester.phone ?? undefined,
                    };
                }
                if (context.creator) {
                    return {
                        recipientType,
                        firstName: context.creator.firstName,
                        lastName: context.creator.lastName,
                        email: context.creator.email ?? undefined,
                        phone: context.creator.phone ?? undefined,
                    };
                }
                return null;

            case VisitorNotificationRecipient.SecurityCenter:
                if (!context.securityCenter?.email) return null;
                return {
                    recipientType,
                    firstName: context.securityCenter.name ?? 'מוקד ביטחון',
                    lastName: '',
                    email: context.securityCenter.email,
                };

            default:
                return null;
        }
    }

    private async sendNotification(
        rule: VisitorNotificationRule,
        channel: VisitorNotificationChannel,
        recipient: ResolvedRecipient,
        context: VisitorNotificationContext,
    ): Promise<NotificationDispatchResult> {
        const baseResult: NotificationDispatchResult = {
            scenario: rule.scenario,
            recipient: rule.recipient,
            channel,
            success: false,
        };

        try {
            if (channel === VisitorNotificationChannel.Email) {
                return await this.sendEmail(rule, recipient, context, baseResult);
            } else if (channel === VisitorNotificationChannel.Sms) {
                return await this.sendSms(rule, recipient, context, baseResult);
            }

            return { ...baseResult, skippedReason: `Unknown channel: ${channel}` };
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            this.logger.error(
                `Notification failed [${rule.scenario}/${rule.recipient}/${channel}]: ${message}`,
            );
            return { ...baseResult, error: message };
        }
    }

    private async sendEmail(
        rule: VisitorNotificationRule,
        recipient: ResolvedRecipient,
        context: VisitorNotificationContext,
        baseResult: NotificationDispatchResult,
    ): Promise<NotificationDispatchResult> {
        if (!recipient.email) {
            this.logger.debug(
                `Skipping email for ${rule.scenario}/${rule.recipient}: no email address`,
            );
            return { ...baseResult, skippedReason: 'Recipient has no email address' };
        }

        if (!this.emailProvider.isConfigured()) {
            return { ...baseResult, skippedReason: 'Email provider not configured' };
        }

        const template = await this.emailTemplateRepo.findOne({
            where: { event: rule.templateKey, isActive: true },
        });

        if (!template) {
            this.logger.warn(`No email template found for key "${rule.templateKey}"`);
            return { ...baseResult, skippedReason: `No template for key: ${rule.templateKey}` };
        }

        const templateData = this.buildTemplateData(context);
        const subject = this.emailRenderer.render(template.subject, templateData);
        const html = this.emailRenderer.render(template.bodyHtml, templateData);

        this.logger.log(
            `Sending email [${rule.scenario}] to ${recipient.email} (${recipient.firstName} ${recipient.lastName})`,
        );

        const result = await this.emailProvider.send({ to: recipient.email, subject, html });

        if (result.success) {
            this.logger.log(
                `Email sent [${rule.scenario}/${rule.recipient}] to ${recipient.email}`,
            );
        } else {
            this.logger.warn(
                `Email failed [${rule.scenario}/${rule.recipient}] to ${recipient.email}: ${result.error}`,
            );
        }

        return { ...baseResult, success: result.success, error: result.error };
    }

    private async sendSms(
        rule: VisitorNotificationRule,
        recipient: ResolvedRecipient,
        context: VisitorNotificationContext,
        baseResult: NotificationDispatchResult,
    ): Promise<NotificationDispatchResult> {
        if (!recipient.phone) {
            this.logger.debug(
                `Skipping SMS for ${rule.scenario}/${rule.recipient}: no phone number`,
            );
            return { ...baseResult, skippedReason: 'Recipient has no phone number' };
        }

        if (!this.smsProvider.isConfigured()) {
            return { ...baseResult, skippedReason: 'SMS provider not configured' };
        }

        const template = await this.smsTemplateRepo.findOne({
            where: { event: rule.templateKey, isActive: true },
        });

        if (!template) {
            this.logger.warn(`No SMS template found for key "${rule.templateKey}"`);
            return { ...baseResult, skippedReason: `No template for key: ${rule.templateKey}` };
        }

        const templateData = this.buildTemplateData(context);
        const message = this.smsRenderer.render(template.template, templateData);

        this.logger.log(
            `Sending SMS [${rule.scenario}] to ${recipient.phone} (${recipient.firstName} ${recipient.lastName})`,
        );

        const result = await this.smsProvider.send({ to: recipient.phone, message });

        if (result.success) {
            this.logger.log(
                `SMS sent [${rule.scenario}/${rule.recipient}] to ${recipient.phone}`,
            );
        } else {
            this.logger.warn(
                `SMS failed [${rule.scenario}/${rule.recipient}] to ${recipient.phone}: ${result.error}`,
            );
        }

        return { ...baseResult, success: result.success, error: result.error };
    }

    private buildTemplateData(context: VisitorNotificationContext) {
        const hostName = context.requester
            ? `${context.requester.firstName} ${context.requester.lastName}`.trim()
            : context.creator
              ? `${context.creator.firstName} ${context.creator.lastName}`.trim()
              : '';

        return {
            visit: {
                title: context.visit.title,
                startTime: context.visit.plannedStartTimeUtc?.toLocaleString('he-IL') ?? '',
                endTime: context.visit.plannedEndTimeUtc?.toLocaleString('he-IL') ?? '',
                hostName,
                siteName: context.visit.siteId ?? '',
                purposeOfVisit: context.visit.purposeOfVisit ?? '',
            },
            visitor: context.visitor
                ? {
                      firstName: context.visitor.firstName,
                      lastName: context.visitor.lastName,
                      personId: context.visitor.personId ?? '',
                      phone: context.visitor.phone ?? '',
                      carNumber: context.visitor.carNumber ?? '',
                      checkInCode: context.checkInCode ?? '',
                  }
                : undefined,
            parking: context.parking
                ? {
                      status: context.parking.status,
                      reviewNote: context.parking.reviewNote ?? '',
                  }
                : undefined,
            requester: context.requester
                ? {
                      phone: context.requester.phone ?? undefined,
                      email: context.requester.email ?? undefined,
                  }
                : undefined,
        };
    }
}
