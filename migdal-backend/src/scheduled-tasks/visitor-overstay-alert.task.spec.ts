import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { VisitorOverstayAlertTask } from './visitor-overstay-alert.task';
import { VisitStatusService } from '../visitors/visit-status.service';
import { UsersGateway } from '../websocket/gateways/users.gateway';
import { SmsNotificationService } from '../settings/sms-notification.service';
import { EmailNotificationService } from '../settings/email-notification.service';
import { AuditService } from '../audit/audit.service';
import { WsEvent } from '../websocket/enums/ws-events.enum';
import { NotificationEvent } from '../settings/enums/notification-event.enum';
import { VisitorNotificationDispatcherService } from '../visitors/notifications/visitor-notification-dispatcher.service';

describe('VisitorOverstayAlertTask', () => {
    let task: VisitorOverstayAlertTask;
    let mockStatusService: Record<string, jest.Mock>;
    let mockWsGateway: Record<string, jest.Mock>;
    let mockSmsNotification: Record<string, jest.Mock>;
    let mockEmailNotification: Record<string, jest.Mock>;
    let mockAuditService: Record<string, jest.Mock>;
    let mockNotificationDispatcher: Record<string, jest.Mock>;
    let mockConfigService: Record<string, jest.Mock>;

    const createMockOverstayStatus = (index: number) => ({
        visitVisitorId: `vv-${index}`,
        visitId: `visit-${index}`,
        visitorId: `visitor-${index}`,
        visitVisitor: {
            visit: {
                id: `visit-${index}`,
                title: `Visit ${index}`,
                plannedStartTimeUtc: new Date('2026-05-26T08:00:00Z'),
                plannedEndTimeUtc: new Date('2026-05-26T10:00:00Z'),
                siteId: 'site-1',
                visitRequesterFirstName: 'John',
                visitRequesterLastName: 'Doe',
                visitRequesterPhone: '0501234567',
                visitRequesterEmail: 'john@example.com',
                visitRequesterUserId: null,
                visitRequesterUser: null,
                purposeOfVisit: 'Meeting',
            },
            visitor: {
                id: `visitor-${index}`,
                firstName: 'Jane',
                lastName: `Visitor${index}`,
                personId: `ID-${index}`,
                phone: '0509876543',
                email: 'jane@example.com',
                carNumber: null,
            },
        },
    });

    beforeEach(async () => {
        mockStatusService = {
            findOverstayVisitors: jest.fn().mockResolvedValue([]),
            markOverstayAlertSent: jest.fn().mockResolvedValue(undefined),
        };

        mockWsGateway = {
            broadcastToAll: jest.fn(),
        };

        mockSmsNotification = {
            triggerSms: jest.fn().mockResolvedValue(undefined),
        };

        mockEmailNotification = {
            triggerEmail: jest.fn().mockResolvedValue(undefined),
        };

        mockAuditService = {
            log: jest.fn().mockResolvedValue(undefined),
        };

        mockNotificationDispatcher = {
            dispatch: jest.fn().mockResolvedValue([]),
        };

        mockConfigService = {
            get: jest.fn().mockReturnValue('security@company.com'),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                VisitorOverstayAlertTask,
                { provide: VisitStatusService, useValue: mockStatusService },
                { provide: UsersGateway, useValue: mockWsGateway },
                { provide: SmsNotificationService, useValue: mockSmsNotification },
                { provide: EmailNotificationService, useValue: mockEmailNotification },
                { provide: AuditService, useValue: mockAuditService },
                { provide: VisitorNotificationDispatcherService, useValue: mockNotificationDispatcher },
                { provide: ConfigService, useValue: mockConfigService },
            ],
        }).compile();

        task = module.get<VisitorOverstayAlertTask>(VisitorOverstayAlertTask);
    });

    it('should do nothing when no overstaying visitors found', async () => {
        await task.handleCron();

        expect(mockStatusService.findOverstayVisitors).toHaveBeenCalledWith(120);
        expect(mockWsGateway.broadcastToAll).not.toHaveBeenCalled();
        expect(mockStatusService.markOverstayAlertSent).not.toHaveBeenCalled();
    });

    it('should broadcast WS event for each overstaying visitor', async () => {
        const overstay = [createMockOverstayStatus(1), createMockOverstayStatus(2)];
        mockStatusService.findOverstayVisitors.mockResolvedValue(overstay);

        await task.handleCron();

        expect(mockWsGateway.broadcastToAll).toHaveBeenCalledTimes(2);
        expect(mockWsGateway.broadcastToAll).toHaveBeenCalledWith(
            WsEvent.VisitorsVisitorOverstay,
            expect.objectContaining({
                visitId: 'visit-1',
                visitVisitorId: 'vv-1',
                visitorId: 'visitor-1',
                visitorName: 'Jane Visitor1',
            }),
        );
    });

    it('should trigger SMS and email notifications', async () => {
        const overstay = [createMockOverstayStatus(1)];
        mockStatusService.findOverstayVisitors.mockResolvedValue(overstay);

        await task.handleCron();

        expect(mockSmsNotification.triggerSms).toHaveBeenCalledWith(
            NotificationEvent.VisitorOverstay,
            expect.objectContaining({ visit: expect.any(Object) }),
        );
        expect(mockEmailNotification.triggerEmail).toHaveBeenCalledWith(
            NotificationEvent.VisitorOverstay,
            expect.objectContaining({ visit: expect.any(Object) }),
        );
    });

    it('should mark overstay alerts as sent after processing', async () => {
        const overstay = [createMockOverstayStatus(1), createMockOverstayStatus(2)];
        mockStatusService.findOverstayVisitors.mockResolvedValue(overstay);

        await task.handleCron();

        expect(mockStatusService.markOverstayAlertSent).toHaveBeenCalledWith(['vv-1', 'vv-2']);
    });

    it('should not throw if service throws', async () => {
        mockStatusService.findOverstayVisitors.mockRejectedValue(new Error('DB down'));
        await expect(task.handleCron()).resolves.not.toThrow();
    });

    it('should skip if already running', async () => {
        let resolve: () => void;
        const blockingPromise = new Promise<any[]>((r) => {
            resolve = () => r([createMockOverstayStatus(1)]);
        });
        mockStatusService.findOverstayVisitors.mockReturnValue(blockingPromise);

        const first = task.handleCron();
        await task.handleCron(); // should skip

        resolve!();
        await first;

        expect(mockStatusService.findOverstayVisitors).toHaveBeenCalledTimes(1);
    });

    it('should reset running flag after completion', async () => {
        await task.handleCron();
        expect(task.isRunning()).toBe(false);
    });

    it('should reset running flag after error', async () => {
        mockStatusService.findOverstayVisitors.mockRejectedValue(new Error('fail'));
        await task.handleCron();
        expect(task.isRunning()).toBe(false);
    });

    it('should audit each overstay alert', async () => {
        const overstay = [createMockOverstayStatus(1)];
        mockStatusService.findOverstayVisitors.mockResolvedValue(overstay);

        await task.handleCron();

        expect(mockAuditService.log).toHaveBeenCalledWith(
            expect.objectContaining({
                module: 'visitors',
                action: 'OVERSTAY_ALERT',
                entity: 'VisitVisitorStatus',
                entityId: 'vv-1',
            }),
        );
    });
});
