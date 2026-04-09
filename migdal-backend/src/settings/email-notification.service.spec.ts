import { Test, TestingModule } from '@nestjs/testing';
import { EmailNotificationService } from './email-notification.service';
import { EmailTemplateService } from './email-template.service';
import { EmailTemplateRendererService } from './email-template-renderer.service';
import { EmailProviderService } from './email-provider.service';
import { NotificationSettingsService } from './notification-settings.service';
import { AuditService } from '../audit/audit.service';
import { NotificationEvent } from './enums/notification-event.enum';

describe('EmailNotificationService', () => {
    let service: EmailNotificationService;
    let mockTemplateService: Partial<EmailTemplateService>;
    let mockRenderer: Partial<EmailTemplateRendererService>;
    let mockProvider: Partial<EmailProviderService>;
    let mockNotificationSettings: Partial<NotificationSettingsService>;
    let mockAudit: Partial<AuditService>;

    beforeEach(async () => {
        mockTemplateService = {
            loadTemplate: jest.fn().mockReturnValue({
                event: 'visit_created',
                subject: 'Subject: {{visit.title}}',
                bodyHtml: '<p>{{visit.title}}</p>',
            }),
            getRecipients: jest.fn().mockReturnValue(['test@example.com']),
        };
        mockRenderer = {
            render: jest.fn().mockReturnValue('Rendered'),
        };
        mockProvider = {
            isConfigured: jest.fn().mockReturnValue(true),
            sendBulk: jest.fn().mockResolvedValue([{ success: true, to: 'test@example.com' }]),
        };
        mockNotificationSettings = {
            isEnabled: jest.fn().mockResolvedValue(true),
        };
        mockAudit = {
            log: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EmailNotificationService,
                { provide: EmailTemplateService, useValue: mockTemplateService },
                { provide: EmailTemplateRendererService, useValue: mockRenderer },
                { provide: EmailProviderService, useValue: mockProvider },
                { provide: NotificationSettingsService, useValue: mockNotificationSettings },
                { provide: AuditService, useValue: mockAudit },
            ],
        }).compile();

        service = module.get<EmailNotificationService>(EmailNotificationService);
    });

    describe('triggerEmail', () => {
        const eventData = {
            visit: { title: 'Test Visit', startTime: '09:00' },
            visitor: { firstName: 'John', lastName: 'Doe', personId: '123' },
        };

        it('should skip when provider is not configured', async () => {
            (mockProvider.isConfigured as jest.Mock).mockReturnValue(false);
            await service.triggerEmail(NotificationEvent.VisitCreated, eventData);
            expect(mockTemplateService.loadTemplate).not.toHaveBeenCalled();
        });

        it('should skip when email is disabled in notification settings', async () => {
            (mockNotificationSettings.isEnabled as jest.Mock).mockResolvedValue(false);
            await service.triggerEmail(NotificationEvent.VisitCreated, eventData);
            expect(mockTemplateService.loadTemplate).not.toHaveBeenCalled();
        });

        it('should skip when no template found for event', async () => {
            (mockTemplateService.loadTemplate as jest.Mock).mockReturnValue(null);
            await service.triggerEmail(NotificationEvent.VisitCreated, eventData);
            expect(mockProvider.sendBulk).not.toHaveBeenCalled();
        });

        it('should skip when no recipients configured', async () => {
            (mockTemplateService.getRecipients as jest.Mock).mockReturnValue([]);
            await service.triggerEmail(NotificationEvent.VisitCreated, eventData);
            expect(mockProvider.sendBulk).not.toHaveBeenCalled();
        });

        it('should render subject and body, then send to all recipients', async () => {
            (mockRenderer.render as jest.Mock)
                .mockReturnValueOnce('Rendered Subject')
                .mockReturnValueOnce('<p>Rendered Body</p>');
            (mockTemplateService.getRecipients as jest.Mock).mockReturnValue(['a@example.com', 'b@example.com']);

            await service.triggerEmail(NotificationEvent.VisitCreated, eventData);

            expect(mockRenderer.render).toHaveBeenCalledTimes(2);
            expect(mockRenderer.render).toHaveBeenCalledWith('Subject: {{visit.title}}', eventData);
            expect(mockRenderer.render).toHaveBeenCalledWith('<p>{{visit.title}}</p>', eventData);
            expect(mockProvider.sendBulk).toHaveBeenCalledWith([
                { to: 'a@example.com', subject: 'Rendered Subject', html: '<p>Rendered Body</p>' },
                { to: 'b@example.com', subject: 'Rendered Subject', html: '<p>Rendered Body</p>' },
            ]);
        });

        it('should log successful sends via audit service', async () => {
            await service.triggerEmail(NotificationEvent.VisitCreated, eventData);

            expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({
                action: 'EMAIL_SENT',
                entity: 'EmailNotification',
            }));
        });

        it('should not throw when provider fails', async () => {
            (mockProvider.sendBulk as jest.Mock).mockRejectedValue(new Error('Provider down'));

            await expect(
                service.triggerEmail(NotificationEvent.VisitCreated, eventData),
            ).resolves.not.toThrow();
        });

        it('should log error via audit when triggerEmail fails', async () => {
            (mockProvider.sendBulk as jest.Mock).mockRejectedValue(new Error('Provider down'));

            await service.triggerEmail(NotificationEvent.VisitCreated, eventData);

            expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({
                action: 'EMAIL_SEND_ERROR',
                entity: 'EmailNotification',
            }));
        });

        it('should handle visitor_arrived event', async () => {
            (mockTemplateService.loadTemplate as jest.Mock).mockReturnValue({
                event: 'visitor_arrived',
                subject: 'Arrived: {{visitor.firstName}}',
                bodyHtml: '<p>{{visitor.firstName}} arrived</p>',
            });

            await service.triggerEmail(NotificationEvent.VisitorArrived, eventData);
            expect(mockRenderer.render).toHaveBeenCalled();
            expect(mockProvider.sendBulk).toHaveBeenCalled();
        });

        it('should handle visitor_blacklisted event', async () => {
            (mockTemplateService.loadTemplate as jest.Mock).mockReturnValue({
                event: 'visitor_blacklisted',
                subject: 'WARNING',
                bodyHtml: '<p>{{visitor.firstName}} is blacklisted</p>',
            });

            await service.triggerEmail(NotificationEvent.VisitorBlacklisted, eventData);
            expect(mockRenderer.render).toHaveBeenCalled();
        });

        it('should check multiple target groups for email settings', async () => {
            (mockNotificationSettings.isEnabled as jest.Mock).mockResolvedValue(false);

            await service.triggerEmail(NotificationEvent.VisitCreated, eventData);

            expect(mockNotificationSettings.isEnabled).toHaveBeenCalledWith('system_users', NotificationEvent.VisitCreated, 'email');
            expect(mockNotificationSettings.isEnabled).toHaveBeenCalledWith('visitors', NotificationEvent.VisitCreated, 'email');
            expect(mockNotificationSettings.isEnabled).toHaveBeenCalledWith('escorts', NotificationEvent.VisitCreated, 'email');
            expect(mockNotificationSettings.isEnabled).toHaveBeenCalledWith('visit_requester', NotificationEvent.VisitCreated, 'email');
        });

        it('should proceed when at least one target group has email enabled', async () => {
            (mockNotificationSettings.isEnabled as jest.Mock).mockImplementation(
                async (group: string) => group === 'visitors',
            );

            await service.triggerEmail(NotificationEvent.VisitCreated, eventData);
            expect(mockProvider.sendBulk).toHaveBeenCalled();
        });
    });
});
