import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { VisitStatusService } from '../visitors/visit-status.service';
import { UsersGateway } from '../websocket/gateways/users.gateway';
import { SmsNotificationService } from '../settings/sms-notification.service';
import { EmailNotificationService } from '../settings/email-notification.service';
import { NotificationEvent } from '../settings/enums/notification-event.enum';
import { AuditService } from '../audit/audit.service';
import { WsEvent } from '../websocket/enums/ws-events.enum';
import { buildSmsData } from '../visitors/visit.utils';
import { VisitorNotificationDispatcherService } from '../visitors/notifications/visitor-notification-dispatcher.service';
import { VisitorNotificationScenario } from '../visitors/notifications/visitor-notification.types';
import { resolveVisitRequester } from '../visitors/visit.utils';

/** Grace period: 2 hours (120 minutes) after daily end time */
const OVERSTAY_GRACE_PERIOD_MINUTES = 120;

@Injectable()
export class VisitorOverstayAlertTask {
    private readonly logger = new Logger(VisitorOverstayAlertTask.name);
    private running = false;

    constructor(
        private readonly statusService: VisitStatusService,
        private readonly wsGateway: UsersGateway,
        private readonly smsNotification: SmsNotificationService,
        private readonly emailNotification: EmailNotificationService,
        private readonly auditService: AuditService,
        private readonly notificationDispatcher: VisitorNotificationDispatcherService,
        private readonly configService: ConfigService,
    ) {}

    @Cron(CronExpression.EVERY_10_MINUTES, { name: 'visitor-overstay-alert' })
    async handleCron(): Promise<void> {
        if (this.running) {
            this.logger.warn('Visitor overstay alert task already in progress, skipping');
            return;
        }

        this.running = true;
        this.logger.log('Visitor overstay alert task started');

        try {
            const overstayVisitors = await this.statusService.findOverstayVisitors(OVERSTAY_GRACE_PERIOD_MINUTES);

            if (overstayVisitors.length === 0) {
                this.logger.log('No overstaying visitors found');
                return;
            }

            this.logger.log(`Found ${overstayVisitors.length} overstaying visitor(s)`);

            for (const status of overstayVisitors) {
                const visit = status.visitVisitor.visit;
                const visitor = status.visitVisitor.visitor;

                // Broadcast WebSocket alert to security center
                this.wsGateway.broadcastToAll(WsEvent.VisitorsVisitorOverstay, {
                    visitId: status.visitId,
                    visitVisitorId: status.visitVisitorId,
                    visitorId: status.visitorId,
                    visitorName: `${visitor.firstName} ${visitor.lastName}`,
                    visitTitle: visit.title,
                    plannedEndTimeUtc: visit.plannedEndTimeUtc,
                });

                // Send notifications
                const smsData = buildSmsData(visit, visitor);
                await this.smsNotification.triggerSms(NotificationEvent.VisitorOverstay, smsData);
                await this.emailNotification.triggerEmail(NotificationEvent.VisitorOverstay, smsData);

                // Audit
                this.auditService.log({
                    userId: null,
                    module: 'visitors',
                    action: 'OVERSTAY_ALERT',
                    entity: 'VisitVisitorStatus',
                    entityId: status.visitVisitorId,
                    description: `Overstay alert: visitor ${visitor.firstName} ${visitor.lastName} not checked out 2h after visit end`,
                    newValue: {
                        visitId: status.visitId,
                        visitorId: status.visitorId,
                        plannedEndTimeUtc: visit.plannedEndTimeUtc,
                    },
                }).catch(() => {});

                // Dispatch "visitor did not exit" email to host + security center
                const requester = resolveVisitRequester(visit);
                const securityCenterEmail = this.configService.get<string>('SECURITY_CENTER_EMAIL');
                await this.notificationDispatcher.dispatch(
                    VisitorNotificationScenario.VisitorDidNotExit,
                    {
                        visit: {
                            id: visit.id,
                            title: visit.title,
                            plannedStartTimeUtc: visit.plannedStartTimeUtc,
                            plannedEndTimeUtc: visit.plannedEndTimeUtc,
                            siteId: visit.siteId,
                            floor: visit.floor,
                            purposeOfVisit: visit.purposeOfVisit,
                        },
                        visitor: {
                            id: visitor.id,
                            firstName: visitor.firstName,
                            lastName: visitor.lastName,
                            personId: visitor.personId,
                            phone: visitor.phone,
                            email: visitor.email,
                            carNumber: visitor.carNumber,
                        },
                        creator: visit.createdByUser ? {
                            id: visit.createdByUser.id,
                            firstName: visit.createdByUser.firstName,
                            lastName: visit.createdByUser.lastName,
                            email: visit.createdByUser.email,
                            phone: visit.createdByUser.phone,
                        } : undefined,
                        requester: requester ? {
                            id: visit.visitRequesterUserId ?? undefined,
                            firstName: requester.firstName,
                            lastName: requester.lastName,
                            email: requester.email,
                            phone: requester.phone,
                        } : undefined,
                        hasEscort: false,
                        securityCenter: securityCenterEmail ? { email: securityCenterEmail } : undefined,
                    },
                ).catch((err) => {
                    this.logger.error(`Failed to dispatch VisitorDidNotExit for visitor ${visitor.firstName} ${visitor.lastName}`, (err as Error).stack);
                });
            }

            // Mark all as alerted to prevent duplicate alerts
            await this.statusService.markOverstayAlertSent(
                overstayVisitors.map((s) => s.visitVisitorId),
            );

            this.logger.log(`Visitor overstay alert task completed — alerted: ${overstayVisitors.length}`);
        } catch (err) {
            this.logger.error('Visitor overstay alert task failed unexpectedly', (err as Error).stack);
        } finally {
            this.running = false;
        }
    }

    isRunning(): boolean {
        return this.running;
    }
}
