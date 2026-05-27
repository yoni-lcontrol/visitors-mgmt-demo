import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VisitorNotificationDispatcherService } from './visitor-notification-dispatcher.service';
import { SmsProviderService } from '../../settings/sms-provider.service';
import { EmailProviderService } from '../../settings/email-provider.service';
import { SmsTemplateRendererService } from '../../settings/sms-template-renderer.service';
import { EmailTemplateRendererService } from '../../settings/email-template-renderer.service';
import { SmsTemplate } from '../../settings/entities/sms-template.entity';
import { EmailTemplate } from '../../settings/entities/email-template.entity';
import { AuditService } from '../../audit/audit.service';
import {
    VisitorNotificationScenario,
    VisitorNotificationRecipient,
    VisitorNotificationChannel,
    VisitorNotificationContext,
} from './visitor-notification.types';

describe('VisitorNotificationDispatcherService', () => {
    let service: VisitorNotificationDispatcherService;
    let mockSmsProvider: Record<string, jest.Mock>;
    let mockEmailProvider: Record<string, jest.Mock>;
    let mockSmsRenderer: Record<string, jest.Mock>;
    let mockEmailRenderer: Record<string, jest.Mock>;
    let mockSmsTemplateRepo: Record<string, jest.Mock>;
    let mockEmailTemplateRepo: Record<string, jest.Mock>;
    let mockAuditService: Record<string, jest.Mock>;

    const baseContext: VisitorNotificationContext = {
        visit: {
            id: 'visit-1',
            title: 'Test Visit',
            plannedStartTimeUtc: new Date('2026-05-26T08:00:00Z'),
            plannedEndTimeUtc: new Date('2026-05-26T17:00:00Z'),
            siteId: 'site-1',
            floor: 5,
            purposeOfVisit: 'Meeting',
        },
        visitor: {
            id: 'visitor-1',
            firstName: 'Jane',
            lastName: 'Doe',
            personId: '123456789',
            phone: '0501234567',
            email: 'jane@example.com',
            carNumber: '1234567',
        },
        creator: {
            id: 'user-creator',
            firstName: 'Avi',
            lastName: 'Cohen',
            email: 'avi@company.com',
            phone: '0521111111',
        },
        requester: {
            id: 'user-requester',
            firstName: 'Moshe',
            lastName: 'Levi',
            email: 'moshe@company.com',
            phone: '0522222222',
        },
        hasEscort: true,
    };

    beforeEach(async () => {
        mockSmsProvider = {
            isConfigured: jest.fn().mockReturnValue(true),
            send: jest.fn().mockResolvedValue({ success: true, to: '0501234567' }),
        };
        mockEmailProvider = {
            isConfigured: jest.fn().mockReturnValue(true),
            send: jest.fn().mockResolvedValue({ success: true, to: 'test@example.com' }),
        };
        mockSmsRenderer = {
            render: jest.fn().mockReturnValue('SMS message content'),
        };
        mockEmailRenderer = {
            render: jest.fn().mockReturnValue('Email content'),
        };
        mockSmsTemplateRepo = {
            findOne: jest.fn().mockResolvedValue({ event: 'test', template: 'Hello {{visitor.firstName}}', isActive: true }),
        };
        mockEmailTemplateRepo = {
            findOne: jest.fn().mockResolvedValue({ event: 'test', subject: 'Subject', bodyHtml: '<p>Body</p>', isActive: true }),
        };
        mockAuditService = {
            log: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                VisitorNotificationDispatcherService,
                { provide: SmsProviderService, useValue: mockSmsProvider },
                { provide: EmailProviderService, useValue: mockEmailProvider },
                { provide: SmsTemplateRendererService, useValue: mockSmsRenderer },
                { provide: EmailTemplateRendererService, useValue: mockEmailRenderer },
                { provide: getRepositoryToken(SmsTemplate), useValue: mockSmsTemplateRepo },
                { provide: getRepositoryToken(EmailTemplate), useValue: mockEmailTemplateRepo },
                { provide: AuditService, useValue: mockAuditService },
            ],
        }).compile();

        service = module.get<VisitorNotificationDispatcherService>(VisitorNotificationDispatcherService);
    });

    // ─── Scenario 1: Visit Created → Creator (email only) ───

    describe('Scenario 1: VisitCreated', () => {
        it('should send email to visit creator', async () => {
            const results = await service.dispatch(VisitorNotificationScenario.VisitCreated, baseContext);

            const emailResults = results.filter(
                (r) => r.recipient === VisitorNotificationRecipient.VisitCreator && r.channel === VisitorNotificationChannel.Email,
            );
            expect(emailResults.length).toBe(1);
            expect(emailResults[0].success).toBe(true);
            expect(mockEmailProvider.send).toHaveBeenCalledWith(
                expect.objectContaining({ to: 'avi@company.com' }),
            );
        });

        it('should NOT send SMS to visit creator', async () => {
            const results = await service.dispatch(VisitorNotificationScenario.VisitCreated, baseContext);

            const smsResults = results.filter(
                (r) => r.recipient === VisitorNotificationRecipient.VisitCreator && r.channel === VisitorNotificationChannel.Sms,
            );
            expect(smsResults.length).toBe(0);
        });
    });

    // ─── Scenario 2: Visit Created On Behalf → Requester (email only) ───

    describe('Scenario 2: VisitCreatedOnBehalf', () => {
        it('should send email to requester when different from creator', async () => {
            const results = await service.dispatch(VisitorNotificationScenario.VisitCreatedOnBehalf, baseContext);

            const emailResults = results.filter(
                (r) => r.recipient === VisitorNotificationRecipient.VisitRequester && r.channel === VisitorNotificationChannel.Email,
            );
            expect(emailResults.length).toBe(1);
            expect(emailResults[0].success).toBe(true);
            expect(mockEmailProvider.send).toHaveBeenCalledWith(
                expect.objectContaining({ to: 'moshe@company.com' }),
            );
        });

        it('should skip if requester is same as creator', async () => {
            const ctx = {
                ...baseContext,
                requester: { ...baseContext.creator!, id: baseContext.creator!.id },
            };
            const results = await service.dispatch(VisitorNotificationScenario.VisitCreatedOnBehalf, ctx);

            const emailResults = results.filter(
                (r) => r.recipient === VisitorNotificationRecipient.VisitRequester,
            );
            expect(emailResults.every((r) => r.skippedReason)).toBe(true);
            expect(mockEmailProvider.send).not.toHaveBeenCalled();
        });
    });

    // ─── Scenario 3: Visit Created → Visitor (email + SMS) ───

    describe('Scenario 3: VisitCreatedVisitor', () => {
        it('should send email and SMS to visitor', async () => {
            const results = await service.dispatch(VisitorNotificationScenario.VisitCreatedVisitor, baseContext);

            const visitorResults = results.filter(
                (r) => r.recipient === VisitorNotificationRecipient.Visitor,
            );
            expect(visitorResults.length).toBe(2);
            expect(visitorResults.every((r) => r.success)).toBe(true);
            expect(mockEmailProvider.send).toHaveBeenCalledWith(
                expect.objectContaining({ to: 'jane@example.com' }),
            );
            expect(mockSmsProvider.send).toHaveBeenCalledWith(
                expect.objectContaining({ to: '0501234567' }),
            );
        });

        it('should skip SMS if visitor has no phone', async () => {
            const ctx = {
                ...baseContext,
                visitor: { ...baseContext.visitor!, phone: null },
            };
            const results = await service.dispatch(VisitorNotificationScenario.VisitCreatedVisitor, ctx);

            const smsResult = results.find(
                (r) => r.recipient === VisitorNotificationRecipient.Visitor && r.channel === VisitorNotificationChannel.Sms,
            );
            expect(smsResult?.skippedReason).toContain('no phone');
        });

        it('should skip email if visitor has no email', async () => {
            const ctx = {
                ...baseContext,
                visitor: { ...baseContext.visitor!, email: null },
            };
            const results = await service.dispatch(VisitorNotificationScenario.VisitCreatedVisitor, ctx);

            const emailResult = results.find(
                (r) => r.recipient === VisitorNotificationRecipient.Visitor && r.channel === VisitorNotificationChannel.Email,
            );
            expect(emailResult?.skippedReason).toContain('no email');
        });
    });

    // ─── Scenario 4: Parking Approved → Creator (email only) ───

    describe('Scenario 4: ParkingApproved', () => {
        it('should send email to creator', async () => {
            const results = await service.dispatch(VisitorNotificationScenario.ParkingApproved, baseContext);

            const emailResults = results.filter(
                (r) => r.recipient === VisitorNotificationRecipient.VisitCreator && r.channel === VisitorNotificationChannel.Email,
            );
            expect(emailResults.length).toBe(1);
            expect(emailResults[0].success).toBe(true);
        });

        it('should NOT send SMS', async () => {
            const results = await service.dispatch(VisitorNotificationScenario.ParkingApproved, baseContext);

            const smsResults = results.filter((r) => r.channel === VisitorNotificationChannel.Sms);
            expect(smsResults.length).toBe(0);
        });
    });

    // ─── Scenario 5: Parking Rejected → Creator (email only) ───

    describe('Scenario 5: ParkingRejected', () => {
        it('should send email to creator', async () => {
            const results = await service.dispatch(VisitorNotificationScenario.ParkingRejected, baseContext);

            const emailResults = results.filter(
                (r) => r.recipient === VisitorNotificationRecipient.VisitCreator && r.channel === VisitorNotificationChannel.Email,
            );
            expect(emailResults.length).toBe(1);
            expect(emailResults[0].success).toBe(true);
        });
    });

    // ─── Scenario 6: Visitor Arrived with Escort → Creator + Requester (email + SMS) ───

    describe('Scenario 6: VisitorArrivedWithEscort', () => {
        it('should send email and SMS to both creator and requester', async () => {
            const results = await service.dispatch(VisitorNotificationScenario.VisitorArrivedWithEscort, baseContext);

            const creatorResults = results.filter(
                (r) => r.recipient === VisitorNotificationRecipient.VisitCreator,
            );
            const requesterResults = results.filter(
                (r) => r.recipient === VisitorNotificationRecipient.VisitRequester,
            );

            expect(creatorResults.length).toBe(2); // email + sms
            expect(creatorResults.every((r) => r.success)).toBe(true);
            expect(requesterResults.length).toBe(2); // email + sms
            expect(requesterResults.every((r) => r.success)).toBe(true);
        });

        it('should skip requester if same as creator', async () => {
            const ctx = {
                ...baseContext,
                requester: { ...baseContext.creator!, id: baseContext.creator!.id },
            };
            const results = await service.dispatch(VisitorNotificationScenario.VisitorArrivedWithEscort, ctx);

            const requesterResults = results.filter(
                (r) => r.recipient === VisitorNotificationRecipient.VisitRequester,
            );
            expect(requesterResults.every((r) => r.skippedReason)).toBe(true);
        });
    });

    // ─── Scenario 7: Visitor Arrived No Escort → Creator + Requester (email + SMS) ───

    describe('Scenario 7: VisitorArrivedNoEscort', () => {
        it('should send email and SMS to creator and requester', async () => {
            const results = await service.dispatch(VisitorNotificationScenario.VisitorArrivedNoEscort, baseContext);

            const creatorResults = results.filter(
                (r) => r.recipient === VisitorNotificationRecipient.VisitCreator,
            );
            expect(creatorResults.length).toBe(2);
            expect(creatorResults.every((r) => r.success)).toBe(true);
        });
    });

    // ─── Scenario 8: QR Code → Visitor (SMS only) ───

    describe('Scenario 8: QrCodeSent', () => {
        it('should send SMS only to visitor', async () => {
            const results = await service.dispatch(VisitorNotificationScenario.QrCodeSent, baseContext);

            expect(results.length).toBe(1);
            expect(results[0].recipient).toBe(VisitorNotificationRecipient.Visitor);
            expect(results[0].channel).toBe(VisitorNotificationChannel.Sms);
            expect(results[0].success).toBe(true);
        });

        it('should NOT send email to visitor', async () => {
            const results = await service.dispatch(VisitorNotificationScenario.QrCodeSent, baseContext);

            const emailResults = results.filter((r) => r.channel === VisitorNotificationChannel.Email);
            expect(emailResults.length).toBe(0);
        });
    });

    // ─── Scenario 9: Visitor Approved No Escort → Requester (email + SMS) ───

    describe('Scenario 9: VisitorApprovedNoEscort', () => {
        it('should send email and SMS to requester', async () => {
            const results = await service.dispatch(VisitorNotificationScenario.VisitorApprovedNoEscort, baseContext);

            const requesterResults = results.filter(
                (r) => r.recipient === VisitorNotificationRecipient.VisitRequester,
            );
            expect(requesterResults.length).toBe(2);
            expect(requesterResults.every((r) => r.success)).toBe(true);
        });
    });

    // ─── Scenario 10: Host Not Approved → Visitor (SMS only) ───

    describe('Scenario 10: HostNotApproved', () => {
        it('should send SMS to visitor', async () => {
            const results = await service.dispatch(VisitorNotificationScenario.HostNotApproved, baseContext);

            expect(results.length).toBe(1);
            expect(results[0].recipient).toBe(VisitorNotificationRecipient.Visitor);
            expect(results[0].channel).toBe(VisitorNotificationChannel.Sms);
            expect(results[0].success).toBe(true);
        });
    });

    // ─── Scenario 12: VisitorDidNotExit → Host + SecurityCenter (email only) ───

    describe('Scenario 12: VisitorDidNotExit', () => {
        const contextWithSecurityCenter: VisitorNotificationContext = {
            ...baseContext,
            securityCenter: { email: 'security@company.com', name: 'מוקד ביטחון' },
        };

        it('should send email to host (requester)', async () => {
            const results = await service.dispatch(VisitorNotificationScenario.VisitorDidNotExit, contextWithSecurityCenter);

            const hostEmailResults = results.filter(
                (r) => r.recipient === VisitorNotificationRecipient.Host && r.channel === VisitorNotificationChannel.Email,
            );
            expect(hostEmailResults.length).toBe(1);
            expect(hostEmailResults[0].success).toBe(true);
            expect(mockEmailProvider.send).toHaveBeenCalledWith(
                expect.objectContaining({ to: 'moshe@company.com' }),
            );
        });

        it('should send email to security center', async () => {
            const results = await service.dispatch(VisitorNotificationScenario.VisitorDidNotExit, contextWithSecurityCenter);

            const securityResults = results.filter(
                (r) => r.recipient === VisitorNotificationRecipient.SecurityCenter && r.channel === VisitorNotificationChannel.Email,
            );
            expect(securityResults.length).toBe(1);
            expect(securityResults[0].success).toBe(true);
            expect(mockEmailProvider.send).toHaveBeenCalledWith(
                expect.objectContaining({ to: 'security@company.com' }),
            );
        });

        it('should NOT send SMS for this scenario', async () => {
            const results = await service.dispatch(VisitorNotificationScenario.VisitorDidNotExit, contextWithSecurityCenter);

            const smsResults = results.filter(
                (r) => r.channel === VisitorNotificationChannel.Sms,
            );
            expect(smsResults.length).toBe(0);
        });

        it('should skip security center if email not in context', async () => {
            const results = await service.dispatch(VisitorNotificationScenario.VisitorDidNotExit, baseContext);

            const securityResults = results.filter(
                (r) => r.recipient === VisitorNotificationRecipient.SecurityCenter,
            );
            expect(securityResults.length).toBe(1);
            expect(securityResults[0].skippedReason).toContain('not available');
        });

        it('should still send to host even if security center email is missing', async () => {
            const results = await service.dispatch(VisitorNotificationScenario.VisitorDidNotExit, baseContext);

            const hostEmailResults = results.filter(
                (r) => r.recipient === VisitorNotificationRecipient.Host && r.channel === VisitorNotificationChannel.Email,
            );
            expect(hostEmailResults.length).toBe(1);
            expect(hostEmailResults[0].success).toBe(true);
        });
    });

    // ─── General behavior ───

    describe('General behavior', () => {
        it('should skip if no template found', async () => {
            mockSmsTemplateRepo.findOne.mockResolvedValue(null);
            mockEmailTemplateRepo.findOne.mockResolvedValue(null);

            const results = await service.dispatch(VisitorNotificationScenario.VisitCreatedVisitor, baseContext);

            expect(results.every((r) => r.skippedReason?.includes('No template'))).toBe(true);
        });

        it('should skip if providers not configured', async () => {
            mockSmsProvider.isConfigured.mockReturnValue(false);
            mockEmailProvider.isConfigured.mockReturnValue(false);

            const results = await service.dispatch(VisitorNotificationScenario.VisitCreatedVisitor, baseContext);

            expect(results.every((r) => r.skippedReason?.includes('not configured'))).toBe(true);
        });

        it('should skip if recipient not in context', async () => {
            const ctx = { ...baseContext, creator: undefined };
            const results = await service.dispatch(VisitorNotificationScenario.VisitCreated, ctx);

            expect(results.every((r) => r.skippedReason?.includes('not available'))).toBe(true);
        });

        it('should handle provider send failure gracefully', async () => {
            mockEmailProvider.send.mockResolvedValue({ success: false, to: 'avi@company.com', error: 'SMTP error' });

            const results = await service.dispatch(VisitorNotificationScenario.VisitCreated, baseContext);

            const emailResult = results.find((r) => r.channel === VisitorNotificationChannel.Email);
            expect(emailResult?.success).toBe(false);
            expect(emailResult?.error).toBe('SMTP error');
        });

        it('should handle provider exception gracefully', async () => {
            mockEmailProvider.send.mockRejectedValue(new Error('Connection refused'));

            const results = await service.dispatch(VisitorNotificationScenario.VisitCreated, baseContext);

            const emailResult = results.find((r) => r.channel === VisitorNotificationChannel.Email);
            expect(emailResult?.success).toBe(false);
            expect(emailResult?.error).toBe('Connection refused');
        });

        it('should return empty array for unknown scenario', async () => {
            const results = await service.dispatch('unknown_scenario' as any, baseContext);
            expect(results).toEqual([]);
        });
    });
});
