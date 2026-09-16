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
            loadTemplate: jest.fn().mockResolvedValue({
                event: 'visit_created',
                targetGroup: 'visit_creator',
                subject: 'Subject: {{visit.title}}',
                bodyHtml: '<p>{{visit.title}}</p>',
                recipients: JSON.stringify(['test@example.com']),
            }),
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

        it('should skip when email is disabled for all target groups', async () => {
            (mockNotificationSettings.isEnabled as jest.Mock).mockResolvedValue(false);
            await service.triggerEmail(NotificationEvent.VisitCreated, eventData);
            expect(mockTemplateService.loadTemplate).not.toHaveBeenCalled();
        });

        it('should skip when no template found for event + group', async () => {
            (mockTemplateService.loadTemplate as jest.Mock).mockResolvedValue(null);
            await service.triggerEmail(NotificationEvent.VisitCreated, eventData);
            expect(mockProvider.sendBulk).not.toHaveBeenCalled();
        });

        it('should skip when template has no recipients', async () => {
            (mockTemplateService.loadTemplate as jest.Mock).mockResolvedValue({
                event: 'visit_created',
                targetGroup: 'visit_creator',
                subject: 'Sub',
                bodyHtml: '<p>Body</p>',
                recipients: null,
            });
            await service.triggerEmail(NotificationEvent.VisitCreated, eventData);
            expect(mockProvider.sendBulk).not.toHaveBeenCalled();
        });

        it('should render subject and body, then send per target group', async () => {
            // Only visit_creator enabled
            (mockNotificationSettings.isEnabled as jest.Mock).mockImplementation(
                async (group: string) => group === 'visit_creator',
            );
            (mockRenderer.render as jest.Mock)
                .mockReturnValueOnce('Rendered Subject')
                .mockReturnValueOnce('<p>Rendered Body</p>');

            await service.triggerEmail(NotificationEvent.VisitCreated, eventData);

            expect(mockTemplateService.loadTemplate).toHaveBeenCalledWith(
                NotificationEvent.VisitCreated,
                'visit_creator',
            );
            expect(mockRenderer.render).toHaveBeenCalledTimes(2);
            expect(mockProvider.sendBulk).toHaveBeenCalledWith([
                { to: 'test@example.com', subject: 'Rendered Subject', html: '<p>Rendered Body</p>' },
            ]);
        });

        it('should send to multiple target groups independently', async () => {
            (mockTemplateService.loadTemplate as jest.Mock).mockImplementation(
                async (event: string, group: string) => ({
                    event,
                    targetGroup: group,
                    subject: `Sub-${group}`,
                    bodyHtml: `<p>${group}</p>`,
                    recipients: JSON.stringify([`${group}@example.com`]),
                }),
            );

            await service.triggerEmail(NotificationEvent.VisitCreated, eventData);

            // Should be called for all 4 target groups
            expect(mockTemplateService.loadTemplate).toHaveBeenCalledTimes(4);
            expect(mockProvider.sendBulk).toHaveBeenCalledTimes(4);
        });

        it('should log successful sends via audit service', async () => {
            (mockNotificationSettings.isEnabled as jest.Mock).mockImplementation(
                async (group: string) => group === 'visit_creator',
            );
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

        it('should handle visitor_arrived event per target group', async () => {
            (mockNotificationSettings.isEnabled as jest.Mock).mockImplementation(
                async (group: string) => group === 'visitors',
            );
            (mockTemplateService.loadTemplate as jest.Mock).mockResolvedValue({
                event: 'visitor_arrived_with_escort',
                targetGroup: 'visitors',
                subject: 'Arrived: {{visitor.firstName}}',
                bodyHtml: '<p>{{visitor.firstName}} arrived</p>',
                recipients: JSON.stringify(['visitor@example.com']),
            });

            await service.triggerEmail(NotificationEvent.VisitorArrivedWithEscort, eventData);
            expect(mockTemplateService.loadTemplate).toHaveBeenCalledWith(
                NotificationEvent.VisitorArrivedWithEscort,
                'visitors',
            );
            expect(mockProvider.sendBulk).toHaveBeenCalled();
        });

        it('should check all four target groups for email settings', async () => {
            (mockNotificationSettings.isEnabled as jest.Mock).mockResolvedValue(false);

            await service.triggerEmail(NotificationEvent.VisitCreated, eventData);

            expect(mockNotificationSettings.isEnabled).toHaveBeenCalledWith('visit_creator', NotificationEvent.VisitCreated, 'email');
            expect(mockNotificationSettings.isEnabled).toHaveBeenCalledWith('visitors', NotificationEvent.VisitCreated, 'email');
            expect(mockNotificationSettings.isEnabled).toHaveBeenCalledWith('escorts', NotificationEvent.VisitCreated, 'email');
            expect(mockNotificationSettings.isEnabled).toHaveBeenCalledWith('visit_requester', NotificationEvent.VisitCreated, 'email');
        });

        it('should only send for enabled target groups', async () => {
            (mockNotificationSettings.isEnabled as jest.Mock).mockImplementation(
                async (group: string) => group === 'visitors' || group === 'escorts',
            );

            await service.triggerEmail(NotificationEvent.VisitCreated, eventData);

            expect(mockTemplateService.loadTemplate).toHaveBeenCalledWith(
                NotificationEvent.VisitCreated,
                'visitors',
            );
            expect(mockTemplateService.loadTemplate).toHaveBeenCalledWith(
                NotificationEvent.VisitCreated,
                'escorts',
            );
            // Should NOT have been called for visit_creator and visit_requester
            expect(mockTemplateService.loadTemplate).not.toHaveBeenCalledWith(
                NotificationEvent.VisitCreated,
                'visit_creator',
            );
            expect(mockTemplateService.loadTemplate).not.toHaveBeenCalledWith(
                NotificationEvent.VisitCreated,
                'visit_requester',
            );
        });

        it('should handle invalid recipients JSON gracefully', async () => {
            (mockNotificationSettings.isEnabled as jest.Mock).mockImplementation(
                async (group: string) => group === 'visit_creator',
            );
            (mockTemplateService.loadTemplate as jest.Mock).mockResolvedValue({
                event: 'visit_created',
                targetGroup: 'visit_creator',
                subject: 'Sub',
                bodyHtml: '<p>Body</p>',
                recipients: 'invalid-json',
            });

            await service.triggerEmail(NotificationEvent.VisitCreated, eventData);
            expect(mockProvider.sendBulk).not.toHaveBeenCalled();
        });

        it('should dynamically add requester email for visit_requester group', async () => {
            (mockNotificationSettings.isEnabled as jest.Mock).mockImplementation(
                async (group: string) => group === 'visit_requester',
            );
            (mockTemplateService.loadTemplate as jest.Mock).mockResolvedValue({
                event: 'visitor_arrived_with_escort',
                targetGroup: 'visit_requester',
                subject: '{{visitor.firstName}} arrived',
                bodyHtml: '<p>{{visitor.firstName}} arrived</p>',
                recipients: JSON.stringify([]),
            });

            const dataWithRequester = {
                ...eventData,
                requester: { phone: '+972509999999', email: 'host@example.com' },
            };

            await service.triggerEmail(NotificationEvent.VisitorArrivedWithEscort, dataWithRequester);

            expect(mockProvider.sendBulk).toHaveBeenCalledWith([
                { to: 'host@example.com', subject: 'Rendered', html: 'Rendered' },
            ]);
        });

        it('should not duplicate requester email if already in static recipients', async () => {
            (mockNotificationSettings.isEnabled as jest.Mock).mockImplementation(
                async (group: string) => group === 'visit_requester',
            );
            (mockTemplateService.loadTemplate as jest.Mock).mockResolvedValue({
                event: 'visitor_arrived_with_escort',
                targetGroup: 'visit_requester',
                subject: 'Arrived',
                bodyHtml: '<p>Arrived</p>',
                recipients: JSON.stringify(['host@example.com']),
            });

            const dataWithRequester = {
                ...eventData,
                requester: { email: 'host@example.com' },
            };

            await service.triggerEmail(NotificationEvent.VisitorArrivedWithEscort, dataWithRequester);

            expect(mockProvider.sendBulk).toHaveBeenCalledWith([
                { to: 'host@example.com', subject: 'Rendered', html: 'Rendered' },
            ]);
        });

        it('should not add requester email for non-visit_requester groups', async () => {
            (mockNotificationSettings.isEnabled as jest.Mock).mockImplementation(
                async (group: string) => group === 'visit_creator',
            );
            (mockTemplateService.loadTemplate as jest.Mock).mockResolvedValue({
                event: 'visitor_arrived_with_escort',
                targetGroup: 'visit_creator',
                subject: 'Arrived',
                bodyHtml: '<p>Arrived</p>',
                recipients: JSON.stringify([]),
            });

            const dataWithRequester = {
                ...eventData,
                requester: { email: 'host@example.com' },
            };

            await service.triggerEmail(NotificationEvent.VisitorArrivedWithEscort, dataWithRequester);

            // No static recipients and email should NOT be added for visit_creator
            expect(mockProvider.sendBulk).not.toHaveBeenCalled();
        });
    });
});
