import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SmsNotificationService } from './sms-notification.service';
import { SmsTemplate } from './entities/sms-template.entity';
import { SmsTemplateRendererService } from './sms-template-renderer.service';
import { SmsProviderService } from './sms-provider.service';
import { NotificationSettingsService } from './notification-settings.service';
import { AuditService } from '../audit/audit.service';
import { NotificationEvent } from './enums/notification-event.enum';
import { createMockRepository } from '../test-utils/mock.factory';

describe('SmsNotificationService', () => {
    let service: SmsNotificationService;
    let mockTemplateRepo: ReturnType<typeof createMockRepository>;
    let mockRenderer: Partial<SmsTemplateRendererService>;
    let mockProvider: Partial<SmsProviderService>;
    let mockNotificationSettings: Partial<NotificationSettingsService>;
    let mockAudit: Partial<AuditService>;

    beforeEach(async () => {
        mockTemplateRepo = createMockRepository();
        mockRenderer = {
            render: jest.fn().mockReturnValue('Rendered message'),
        };
        mockProvider = {
            isConfigured: jest.fn().mockReturnValue(true),
            sendBulk: jest.fn().mockResolvedValue([{ success: true, to: '+972501234567' }]),
        };
        mockNotificationSettings = {
            isEnabled: jest.fn().mockResolvedValue(false),
        };
        mockAudit = {
            log: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SmsNotificationService,
                { provide: getRepositoryToken(SmsTemplate), useValue: mockTemplateRepo },
                { provide: SmsTemplateRendererService, useValue: mockRenderer },
                { provide: SmsProviderService, useValue: mockProvider },
                { provide: NotificationSettingsService, useValue: mockNotificationSettings },
                { provide: AuditService, useValue: mockAudit },
            ],
        }).compile();

        service = module.get<SmsNotificationService>(SmsNotificationService);
    });

    describe('triggerSms', () => {
        const eventData = {
            visit: { title: 'Test Visit', startTime: '09:00' },
            visitor: { firstName: 'John', lastName: 'Doe', personId: '123' },
        };

        const enableGroup = (group: string) => {
            (mockNotificationSettings.isEnabled as jest.Mock).mockImplementation(
                async (g: string) => g === group,
            );
        };

        const enableAllGroups = () => {
            (mockNotificationSettings.isEnabled as jest.Mock).mockResolvedValue(true);
        };

        const mockTemplateForGroup = (event: string, group: string, template = '{{visit.title}}', recipients = ['+972501234567']) => {
            (mockTemplateRepo.findOne as jest.Mock).mockImplementation(async (opts: any) => {
                if (opts.where?.event === event && opts.where?.targetGroup === group) {
                    return {
                        event,
                        targetGroup: group,
                        template,
                        recipients: recipients ? JSON.stringify(recipients) : null,
                    };
                }
                return null;
            });
        };

        it('should skip when provider is not configured', async () => {
            (mockProvider.isConfigured as jest.Mock).mockReturnValue(false);
            await service.triggerSms(NotificationEvent.VisitCreated, eventData);
            expect(mockNotificationSettings.isEnabled).not.toHaveBeenCalled();
            expect(mockTemplateRepo.findOne).not.toHaveBeenCalled();
        });

        it('should skip when SMS is disabled for all target groups', async () => {
            // Default: isEnabled returns false for all groups
            await service.triggerSms(NotificationEvent.VisitCreated, eventData);
            expect(mockTemplateRepo.findOne).not.toHaveBeenCalled();
        });

        it('should check all four target groups for SMS settings', async () => {
            await service.triggerSms(NotificationEvent.VisitCreated, eventData);

            expect(mockNotificationSettings.isEnabled).toHaveBeenCalledWith('system_users', NotificationEvent.VisitCreated, 'sms');
            expect(mockNotificationSettings.isEnabled).toHaveBeenCalledWith('visitors', NotificationEvent.VisitCreated, 'sms');
            expect(mockNotificationSettings.isEnabled).toHaveBeenCalledWith('escorts', NotificationEvent.VisitCreated, 'sms');
            expect(mockNotificationSettings.isEnabled).toHaveBeenCalledWith('visit_requester', NotificationEvent.VisitCreated, 'sms');
        });

        it('should load template for the enabled target group only', async () => {
            enableGroup('visitors');
            mockTemplateForGroup('visit_created', 'visitors');

            await service.triggerSms(NotificationEvent.VisitCreated, eventData);

            expect(mockTemplateRepo.findOne).toHaveBeenCalledTimes(1);
            expect(mockTemplateRepo.findOne).toHaveBeenCalledWith({
                where: { event: NotificationEvent.VisitCreated, targetGroup: 'visitors', isActive: true },
            });
        });

        it('should skip group when no template found', async () => {
            enableGroup('visitors');
            mockTemplateRepo.findOne.mockResolvedValue(null);

            await service.triggerSms(NotificationEvent.VisitCreated, eventData);
            expect(mockProvider.sendBulk).not.toHaveBeenCalled();
        });

        it('should skip group when no recipients configured', async () => {
            enableGroup('visitors');
            mockTemplateRepo.findOne.mockResolvedValue({
                event: 'visit_created',
                targetGroup: 'visitors',
                template: '{{visit.title}}',
                recipients: null,
            });

            await service.triggerSms(NotificationEvent.VisitCreated, eventData);
            expect(mockProvider.sendBulk).not.toHaveBeenCalled();
        });

        it('should render template and send to recipients for enabled group', async () => {
            enableGroup('visitors');
            mockTemplateForGroup('visit_created', 'visitors', '{{visit.title}}', ['+972501234567', '+972507654321']);

            await service.triggerSms(NotificationEvent.VisitCreated, eventData);

            expect(mockRenderer.render).toHaveBeenCalledWith('{{visit.title}}', eventData);
            expect(mockProvider.sendBulk).toHaveBeenCalledWith([
                { to: '+972501234567', message: 'Rendered message' },
                { to: '+972507654321', message: 'Rendered message' },
            ]);
        });

        it('should send independently for each enabled group', async () => {
            enableAllGroups();
            mockTemplateRepo.findOne.mockResolvedValue({
                event: 'visit_created',
                targetGroup: 'system_users',
                template: '{{visit.title}}',
                recipients: JSON.stringify(['+972501234567']),
            });

            await service.triggerSms(NotificationEvent.VisitCreated, eventData);

            // All 4 groups enabled → findOne called 4 times, sendBulk called 4 times
            expect(mockTemplateRepo.findOne).toHaveBeenCalledTimes(4);
            expect(mockProvider.sendBulk).toHaveBeenCalledTimes(4);
        });

        it('should log successful sends via audit service', async () => {
            enableGroup('system_users');
            mockTemplateForGroup('visit_created', 'system_users');

            await service.triggerSms(NotificationEvent.VisitCreated, eventData);

            expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({
                action: 'SMS_SENT',
                entity: 'SmsNotification',
            }));
        });

        it('should not throw when provider fails', async () => {
            enableGroup('visitors');
            mockTemplateForGroup('visit_created', 'visitors');
            (mockProvider.sendBulk as jest.Mock).mockRejectedValue(new Error('Provider down'));

            await expect(
                service.triggerSms(NotificationEvent.VisitCreated, eventData),
            ).resolves.not.toThrow();
        });

        it('should handle visitor_arrived event', async () => {
            enableGroup('system_users');
            mockTemplateForGroup('visitor_arrived', 'system_users', '{{visitor.firstName}} arrived');

            await service.triggerSms(NotificationEvent.VisitorArrived, eventData);
            expect(mockRenderer.render).toHaveBeenCalled();
            expect(mockProvider.sendBulk).toHaveBeenCalled();
        });

        it('should handle visitor_blacklisted event', async () => {
            enableGroup('system_users');
            mockTemplateForGroup('visitor_blacklisted', 'system_users', 'WARNING: {{visitor.firstName}} is blacklisted');

            await service.triggerSms(NotificationEvent.VisitorBlacklisted, eventData);
            expect(mockRenderer.render).toHaveBeenCalled();
        });

        it('should handle parking_request_decision event with parking data', async () => {
            enableGroup('visitors');
            const parkingTemplate = '{{visitor.firstName}} parking {{parking.status}}';
            mockTemplateForGroup('parking_request_decision', 'visitors', parkingTemplate);

            const parkingData = {
                ...eventData,
                parking: { status: 'approved', reviewNote: 'OK' },
            };
            await service.triggerSms(NotificationEvent.ParkingRequestDecision, parkingData);
            expect(mockRenderer.render).toHaveBeenCalledWith(parkingTemplate, parkingData);
            expect(mockProvider.sendBulk).toHaveBeenCalled();
        });

        it('should handle visitor_checked_out event', async () => {
            enableGroup('escorts');
            mockTemplateForGroup('visitor_checked_out', 'escorts', '{{visitor.firstName}} checked out from {{visit.siteName}}');

            await service.triggerSms(NotificationEvent.VisitorCheckedOut, eventData);
            expect(mockRenderer.render).toHaveBeenCalled();
            expect(mockProvider.sendBulk).toHaveBeenCalled();
        });

        it('should handle visitor_overstay event', async () => {
            enableGroup('system_users');
            mockTemplateForGroup('visitor_overstay', 'system_users', '{{visitor.firstName}} overstay at {{visit.siteName}} past {{visit.endTime}}');

            await service.triggerSms(NotificationEvent.VisitorOverstay, eventData);
            expect(mockRenderer.render).toHaveBeenCalled();
            expect(mockProvider.sendBulk).toHaveBeenCalled();
        });

        it('should dynamically add requester phone for visit_requester group', async () => {
            enableGroup('visit_requester');
            mockTemplateForGroup('visitor_arrived', 'visit_requester', '{{visitor.firstName}} arrived', []);

            const dataWithRequester = {
                ...eventData,
                requester: { phone: '+972509999999', email: 'host@example.com' },
            };

            await service.triggerSms(NotificationEvent.VisitorArrived, dataWithRequester);

            expect(mockProvider.sendBulk).toHaveBeenCalledWith([
                { to: '+972509999999', message: 'Rendered message' },
            ]);
        });

        it('should not duplicate requester phone if already in static recipients', async () => {
            enableGroup('visit_requester');
            mockTemplateForGroup('visitor_arrived', 'visit_requester', '{{visitor.firstName}} arrived', ['+972509999999']);

            const dataWithRequester = {
                ...eventData,
                requester: { phone: '+972509999999' },
            };

            await service.triggerSms(NotificationEvent.VisitorArrived, dataWithRequester);

            expect(mockProvider.sendBulk).toHaveBeenCalledWith([
                { to: '+972509999999', message: 'Rendered message' },
            ]);
        });

        it('should not add requester phone for non-visit_requester groups', async () => {
            enableGroup('system_users');
            mockTemplateForGroup('visitor_arrived', 'system_users', '{{visitor.firstName}} arrived', []);

            const dataWithRequester = {
                ...eventData,
                requester: { phone: '+972509999999' },
            };

            await service.triggerSms(NotificationEvent.VisitorArrived, dataWithRequester);

            // No static recipients and phone should NOT be added for system_users
            expect(mockProvider.sendBulk).not.toHaveBeenCalled();
        });
    });
});
