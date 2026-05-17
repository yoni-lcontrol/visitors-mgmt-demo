import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { VisitStatusService } from './visit-status.service';
import { Visit } from './entities/visit.entity';
import { VisitVisitor } from './entities/visit-visitor.entity';
import { VisitorAccessLog } from './entities/visitor-access-log.entity';
import { VisitVisitorStatus } from './entities/visit-visitor-status.entity';
import { Visitor } from './entities/visitor.entity';
import { VisitorAccessEventType } from './enums/visitor-access-event-type.enum';
import { VisitorStatus } from './enums/visitor-status.enum';
import { UsersGateway } from '../websocket/gateways/users.gateway';
import { BlacklistService } from './blacklist.service';
import { SmsNotificationService } from '../settings/sms-notification.service';
import { EmailNotificationService } from '../settings/email-notification.service';
import { NotificationEvent } from '../settings/enums/notification-event.enum';
import { AuditService } from '../audit/audit.service';
import {
    createMockRepository,
    createMockQueryBuilder,
    createMockWsGateway,
    createMockBlacklistService,
    createMockDataSource,
    createMockAuditService,
} from '../test-utils/mock.factory';

describe('VisitStatusService', () => {
    let service: VisitStatusService;
    let mockVisitRepo: ReturnType<typeof createMockRepository>;
    let mockVvRepo: ReturnType<typeof createMockRepository>;
    let mockLogRepo: ReturnType<typeof createMockRepository>;
    let mockStatusRepo: ReturnType<typeof createMockRepository>;
    let mockVisitorRepo: ReturnType<typeof createMockRepository>;
    let mockDs: ReturnType<typeof createMockDataSource>;
    let mockWs: ReturnType<typeof createMockWsGateway>;
    let mockBl: ReturnType<typeof createMockBlacklistService>;
    let mockAuditService: ReturnType<typeof createMockAuditService>;
    let mockSmsNotification: { triggerSms: jest.Mock };
    let mockEmailNotification: { triggerEmail: jest.Mock };

    beforeEach(async () => {
        mockVisitRepo = createMockRepository();
        mockVvRepo = createMockRepository();
        mockLogRepo = createMockRepository();
        mockStatusRepo = createMockRepository();
        mockVisitorRepo = createMockRepository();
        mockDs = createMockDataSource();
        mockWs = createMockWsGateway();
        mockBl = createMockBlacklistService();
        mockAuditService = createMockAuditService();
        mockSmsNotification = { triggerSms: jest.fn().mockResolvedValue(undefined) };
        mockEmailNotification = { triggerEmail: jest.fn().mockResolvedValue(undefined) };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                VisitStatusService,
                { provide: getRepositoryToken(Visit), useValue: mockVisitRepo },
                { provide: getRepositoryToken(VisitVisitor), useValue: mockVvRepo },
                { provide: getRepositoryToken(VisitorAccessLog), useValue: mockLogRepo },
                { provide: getRepositoryToken(VisitVisitorStatus), useValue: mockStatusRepo },
                { provide: getRepositoryToken(Visitor), useValue: mockVisitorRepo },
                { provide: DataSource, useValue: mockDs },
                { provide: UsersGateway, useValue: mockWs },
                { provide: BlacklistService, useValue: mockBl },
                { provide: SmsNotificationService, useValue: mockSmsNotification },
                { provide: EmailNotificationService, useValue: mockEmailNotification },
                { provide: AuditService, useValue: mockAuditService },
            ],
        }).compile();

        service = module.get<VisitStatusService>(VisitStatusService);
    });

    // ── Access Logs ──

    describe('createAccessLog', () => {
        let mockOverrideRepo: ReturnType<typeof createMockRepository>;

        beforeEach(() => {
            mockVvRepo.findOne.mockResolvedValue({ id: 'vv1', visitId: 'v1', visitorId: 'vis1', isActive: true });
            mockOverrideRepo = createMockRepository();
            mockOverrideRepo.findOne.mockResolvedValue(null);
            mockDs.getRepository.mockReturnValue(mockOverrideRepo);
        });

        it('should create access log and update status for Arrived event', async () => {
            mockDs._qrManager.findOne.mockResolvedValue({
                visitVisitorId: 'vv1', visitId: 'v1', visitorId: 'vis1',
                currentStatus: VisitorStatus.Pending,
            });

            const result = await service.createAccessLog({
                visitVisitorId: 'vv1',
                eventType: VisitorAccessEventType.Arrived,
            } as any, 'user-1');

            expect(mockDs._queryRunner.commitTransaction).toHaveBeenCalled();
            expect(mockWs.broadcastToAll).toHaveBeenCalledWith('visits:visitor:arrived', expect.any(Object));
        });

        it('should create access log and update status for CheckedIn event', async () => {
            mockDs._qrManager.findOne.mockResolvedValue({
                visitVisitorId: 'vv1', currentStatus: VisitorStatus.Arrived,
            });

            await service.createAccessLog({
                visitVisitorId: 'vv1',
                eventType: VisitorAccessEventType.CheckedIn,
            } as any);

            expect(mockWs.broadcastToAll).toHaveBeenCalledWith('visits:visitor:checked-in', expect.any(Object));
        });

        it('should create access log and update status for CheckedOut event', async () => {
            mockDs._qrManager.findOne.mockResolvedValue({
                visitVisitorId: 'vv1', currentStatus: VisitorStatus.CheckedIn,
            });
            mockVisitRepo.findOne.mockResolvedValue({ id: 'v1' });
            mockVisitorRepo.findOne.mockResolvedValue({ id: 'vis1', firstName: 'Dana', lastName: 'Levi' });

            await service.createAccessLog({
                visitVisitorId: 'vv1',
                eventType: VisitorAccessEventType.CheckedOut,
            } as any);

            expect(mockWs.broadcastToAll).toHaveBeenCalledWith('visits:visitor:checked-out', expect.any(Object));
            expect(mockSmsNotification.triggerSms).toHaveBeenCalledWith(
                NotificationEvent.VisitorCheckedOut,
                expect.any(Object),
            );
            expect(mockEmailNotification.triggerEmail).toHaveBeenCalledWith(
                NotificationEvent.VisitorCheckedOut,
                expect.any(Object),
            );
        });

        it('should create status if none exists', async () => {
            mockDs._qrManager.findOne.mockResolvedValue(null);

            await service.createAccessLog({
                visitVisitorId: 'vv1',
                eventType: VisitorAccessEventType.Arrived,
            } as any);

            expect(mockDs._qrManager.create).toHaveBeenCalledWith(
                VisitVisitorStatus,
                expect.objectContaining({ currentStatus: VisitorStatus.Pending }),
            );
            expect(mockDs._queryRunner.commitTransaction).toHaveBeenCalled();
        });

        it('should throw NotFoundException on missing visit-visitor', async () => {
            mockVvRepo.findOne.mockResolvedValue(null);
            await expect(service.createAccessLog({
                visitVisitorId: 'bad',
                eventType: VisitorAccessEventType.Arrived,
            } as any)).rejects.toThrow(NotFoundException);
        });

        it('should throw ForbiddenException when visitor has pending blacklist override', async () => {
            mockOverrideRepo.findOne.mockResolvedValue({ id: 'override-1', visitVisitorId: 'vv1', status: 'pending' });

            await expect(service.createAccessLog({
                visitVisitorId: 'vv1',
                eventType: VisitorAccessEventType.Arrived,
            } as any)).rejects.toThrow(ForbiddenException);

            expect(mockDs._queryRunner.startTransaction).not.toHaveBeenCalled();
        });

        it('should allow Check-Out even when visitor has pending blacklist override', async () => {
            // Override repo should NOT be queried for CheckedOut events
            mockOverrideRepo.findOne.mockResolvedValue({ id: 'override-1', visitVisitorId: 'vv1', status: 'pending' });

            await service.createAccessLog({
                visitVisitorId: 'vv1',
                eventType: VisitorAccessEventType.CheckedOut,
            } as any);

            expect(mockDs._queryRunner.commitTransaction).toHaveBeenCalled();
        });

        it('should rollback on error', async () => {
            mockDs._qrManager.save.mockRejectedValueOnce(new Error('DB error'));

            await expect(service.createAccessLog({
                visitVisitorId: 'vv1',
                eventType: VisitorAccessEventType.Arrived,
            } as any)).rejects.toThrow('DB error');

            expect(mockDs._queryRunner.rollbackTransaction).toHaveBeenCalled();
        });
    });

    // ── Status & History ──

    describe('getVisitorStatuses', () => {
        it('should return visitor statuses for visit', async () => {
            mockVisitRepo.findOne.mockResolvedValue({ id: 'v1', isActive: true });

            const statusQb = createMockQueryBuilder([{
                visitVisitorId: 'vv1', visitId: 'v1', visitorId: 'vis1',
                currentStatus: VisitorStatus.Arrived,
                arrivedAtUtc: new Date(), checkedInAtUtc: null, checkedOutAtUtc: null, lastEventTimeUtc: new Date(),
                visitVisitor: {
                    visitor: { id: 'vis1', firstName: 'Jane', lastName: 'Smith', email: null, phone: '+972501234567' },
                },
            }]);
            mockStatusRepo.createQueryBuilder.mockReturnValue(statusQb);

            const result = await service.getVisitorStatuses('v1');

            expect(result).toHaveLength(1);
            expect(result[0].currentStatus).toBe(VisitorStatus.Arrived);
        });

        it('should throw NotFoundException on missing visit', async () => {
            mockVisitRepo.findOne.mockResolvedValue(null);
            await expect(service.getVisitorStatuses('bad')).rejects.toThrow(NotFoundException);
        });
    });

    describe('getVisitHistory', () => {
        it('should return access logs ordered by eventTime DESC', async () => {
            mockVisitRepo.findOne.mockResolvedValue({ id: 'v1', isActive: true });
            mockLogRepo.find.mockResolvedValue([{ logId: '1', visitId: 'v1' }]);

            const result = await service.getVisitHistory('v1');

            expect(result).toHaveLength(1);
            expect(mockLogRepo.find).toHaveBeenCalledWith({
                where: { visitId: 'v1' },
                order: { eventTimeUtc: 'DESC' },
            });
        });

        it('should throw NotFoundException on missing visit', async () => {
            mockVisitRepo.findOne.mockResolvedValue(null);
            await expect(service.getVisitHistory('bad')).rejects.toThrow(NotFoundException);
        });
    });

    describe('getVisitVisitorHistory', () => {
        it('should return access logs for specific visit-visitor', async () => {
            mockVvRepo.findOne.mockResolvedValue({ id: 'vv1' });
            mockLogRepo.find.mockResolvedValue([{ logId: '1', visitVisitorId: 'vv1' }]);

            const result = await service.getVisitVisitorHistory('vv1');
            expect(result).toHaveLength(1);
        });

        it('should throw NotFoundException on missing visit-visitor', async () => {
            mockVvRepo.findOne.mockResolvedValue(null);
            await expect(service.getVisitVisitorHistory('bad')).rejects.toThrow(NotFoundException);
        });
    });

    // ── On Site ──

    describe('findOnSiteVisitors', () => {
        const mockVisitor = {
            id: 'vis1', firstName: 'Jane', lastName: 'Smith',
            email: 'j@s.com', phone: '555',
            personId: '123456789', carNumber: 'ABC123',
        };
        const mockVisit = {
            id: 'v1', title: 'Meeting', plannedStartTimeUtc: new Date(),
            plannedEndTimeUtc: null, siteId: 'site1',
            visitRequesterFirstName: 'John', visitRequesterLastName: 'Doe',
            visitRequesterPhone: '123', visitRequesterEmail: 'j@d.com',
            purposeOfVisit: 'Test meeting',
        };

        function buildStatusRecord(overrides = {}) {
            return {
                visitVisitorId: 'vv1',
                visitId: 'v1',
                visitorId: 'vis1',
                currentStatus: VisitorStatus.Arrived,
                arrivedAtUtc: new Date(),
                checkedInAtUtc: null,
                checkedOutAtUtc: null,
                lastEventTimeUtc: new Date(),
                visitVisitor: {
                    id: 'vv1',
                    visitId: 'v1',
                    visitorId: 'vis1',
                    notes: null,
                    visitor: mockVisitor,
                    visit: mockVisit,
                },
                ...overrides,
            };
        }

        it('should return on-site visitors with summary', async () => {
            const records = [buildStatusRecord()];
            const statusQb = createMockQueryBuilder(records, 1);
            mockStatusRepo.createQueryBuilder.mockReturnValue(statusQb);
            mockBl.checkBlacklistStatus.mockResolvedValue({ isBlacklisted: false });

            const summaryQb = createMockQueryBuilder([
                { currentStatus: VisitorStatus.Arrived, cnt: '1' },
            ]);
            // Second call to createQueryBuilder is for summary
            mockStatusRepo.createQueryBuilder
                .mockReturnValueOnce(statusQb)
                .mockReturnValueOnce(summaryQb);

            const result = await service.findOnSiteVisitors({ page: 1, limit: 20 });

            expect(result.items).toHaveLength(1);
            expect(result.items[0].visitId).toBe('v1');
            expect(result.items[0].visitorFullName).toBe('Jane Smith');
            expect(result.items[0].visitTitle).toBe('Meeting');
            expect(result.items[0].currentStatus).toBe(VisitorStatus.Arrived);
            expect(result.items[0].isBlacklisted).toBe(false);
            expect(result.total).toBe(1);
            expect(result.summary).toBeDefined();
        });

        it('should flag blacklisted visitors correctly', async () => {
            const records = [buildStatusRecord()];
            const statusQb = createMockQueryBuilder(records, 1);
            const summaryQb = createMockQueryBuilder([
                { currentStatus: VisitorStatus.Arrived, cnt: '1' },
            ]);
            mockStatusRepo.createQueryBuilder
                .mockReturnValueOnce(statusQb)
                .mockReturnValueOnce(summaryQb);
            mockBl.checkBlacklistStatusBatch.mockResolvedValue(new Map([['123456789', { isBlacklisted: true, reason: 'Banned person' }]]));

            const result = await service.findOnSiteVisitors({ page: 1, limit: 20 });

            expect(result.items[0].isBlacklisted).toBe(true);
            expect(result.items[0].blacklistReason).toBe('Banned person');
            expect(result.summary.blacklisted).toBe(1);
        });

        it('should apply search filter', async () => {
            const statusQb = createMockQueryBuilder([], 0);
            const summaryQb = createMockQueryBuilder([]);
            mockStatusRepo.createQueryBuilder
                .mockReturnValueOnce(statusQb)
                .mockReturnValueOnce(summaryQb);

            await service.findOnSiteVisitors({ page: 1, limit: 20, search: 'Jane' });

            expect(statusQb.andWhere).toHaveBeenCalledWith(
                '(vis.firstName LIKE :s OR vis.lastName LIKE :s OR v.title LIKE :s OR vis.personId LIKE :s)',
                { s: '%Jane%' },
            );
        });

        it('should filter by siteId', async () => {
            const statusQb = createMockQueryBuilder([], 0);
            const summaryQb = createMockQueryBuilder([]);
            mockStatusRepo.createQueryBuilder
                .mockReturnValueOnce(statusQb)
                .mockReturnValueOnce(summaryQb);

            await service.findOnSiteVisitors({ page: 1, limit: 20, siteId: 'site-a' });

            expect(statusQb.andWhere).toHaveBeenCalledWith('v.siteId = :siteId', { siteId: 'site-a' });
        });

        it('should filter by single status (arrived)', async () => {
            const statusQb = createMockQueryBuilder([], 0);
            const summaryQb = createMockQueryBuilder([]);
            mockStatusRepo.createQueryBuilder
                .mockReturnValueOnce(statusQb)
                .mockReturnValueOnce(summaryQb);

            await service.findOnSiteVisitors({ page: 1, limit: 20, status: 'arrived' });

            expect(statusQb.where).toHaveBeenCalledWith(
                's.currentStatus IN (:...statuses)',
                { statuses: [VisitorStatus.Arrived] },
            );
        });

        it('should return empty result when no on-site visitors', async () => {
            const statusQb = createMockQueryBuilder([], 0);
            const summaryQb = createMockQueryBuilder([]);
            mockStatusRepo.createQueryBuilder
                .mockReturnValueOnce(statusQb)
                .mockReturnValueOnce(summaryQb);

            const result = await service.findOnSiteVisitors({ page: 1, limit: 20 });

            expect(result.items).toEqual([]);
            expect(result.total).toBe(0);
            expect(result.summary.onSite).toBe(0);
        });

        it('should use specified date for filtering', async () => {
            const statusQb = createMockQueryBuilder([], 0);
            const summaryQb = createMockQueryBuilder([]);
            mockStatusRepo.createQueryBuilder
                .mockReturnValueOnce(statusQb)
                .mockReturnValueOnce(summaryQb);

            await service.findOnSiteVisitors({ page: 1, limit: 20, date: '2025-06-15' });

            // Should have been called with day boundaries for 2025-06-15
            expect(statusQb.andWhere).toHaveBeenCalledWith(
                'v.plannedStartTimeUtc < :dayEnd',
                expect.objectContaining({ dayEnd: expect.any(Date) }),
            );
            expect(statusQb.andWhere).toHaveBeenCalledWith(
                '(v.plannedStartTimeUtc >= :dayStart OR (v.plannedEndTimeUtc IS NOT NULL AND v.plannedEndTimeUtc >= :dayStartBound))',
                expect.objectContaining({ dayStart: expect.any(Date), dayStartBound: expect.any(Date) }),
            );
        });
    });

    // ── Auto Checkout ──

    describe('autoCheckOutExpiredVisitors', () => {
        it('should return 0 when no open visitors found', async () => {
            const statusQb = createMockQueryBuilder([], 0);
            mockStatusRepo.createQueryBuilder.mockReturnValue(statusQb);

            const result = await service.autoCheckOutExpiredVisitors();

            expect(result).toEqual({ checkedOut: 0 });
            expect(mockDs.createQueryRunner).not.toHaveBeenCalled();
        });

        it('should checkout all expired visitors and commit transaction', async () => {
            const openStatuses: any[] = [
                {
                    visitVisitorId: 'vv1',
                    visitId: 'visit1',
                    visitorId: 'vis1',
                    currentStatus: VisitorStatus.Arrived,
                    visitVisitor: { id: 'vv1' },
                },
                {
                    visitVisitorId: 'vv2',
                    visitId: 'visit2',
                    visitorId: 'vis2',
                    currentStatus: VisitorStatus.CheckedIn,
                    visitVisitor: { id: 'vv2' },
                },
            ];
            const statusQb = createMockQueryBuilder(openStatuses);
            mockStatusRepo.createQueryBuilder.mockReturnValue(statusQb);

            const result = await service.autoCheckOutExpiredVisitors();

            expect(result).toEqual({ checkedOut: 2 });
            expect(mockDs._queryRunner.commitTransaction).toHaveBeenCalled();
            expect(mockDs._queryRunner.release).toHaveBeenCalled();

            // Both statuses should be updated to CheckedOut
            expect(openStatuses[0].currentStatus).toBe(VisitorStatus.CheckedOut);
            expect(openStatuses[1].currentStatus).toBe(VisitorStatus.CheckedOut);
            expect(openStatuses[0].checkedOutAtUtc).toBeDefined();
            expect(openStatuses[1].checkedOutAtUtc).toBeDefined();
        });

        it('should broadcast WS events for each checked-out visitor', async () => {
            const openStatuses = [
                {
                    visitVisitorId: 'vv1',
                    visitId: 'visit1',
                    visitorId: 'vis1',
                    currentStatus: VisitorStatus.Arrived,
                    visitVisitor: { id: 'vv1' },
                },
            ];
            const statusQb = createMockQueryBuilder(openStatuses);
            mockStatusRepo.createQueryBuilder.mockReturnValue(statusQb);

            await service.autoCheckOutExpiredVisitors();

            expect(mockWs.broadcastToAll).toHaveBeenCalledWith('visits:visitor:checked-out', {
                visitId: 'visit1',
                visitVisitorId: 'vv1',
                visitorId: 'vis1',
                eventType: VisitorAccessEventType.CheckedOut,
            });
        });

        it('should create audit log for each checked-out visitor', async () => {
            const openStatuses = [
                {
                    visitVisitorId: 'vv1',
                    visitId: 'visit1',
                    visitorId: 'vis1',
                    currentStatus: VisitorStatus.Arrived,
                    visitVisitor: { id: 'vv1' },
                },
            ];
            const statusQb = createMockQueryBuilder(openStatuses);
            mockStatusRepo.createQueryBuilder.mockReturnValue(statusQb);

            await service.autoCheckOutExpiredVisitors();

            expect(mockAuditService.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    module: 'visitors',
                    action: 'AUTO_CHECKOUT',
                    entity: 'VisitVisitorStatus',
                    entityId: 'vv1',
                }),
            );
        });

        it('should rollback transaction on error', async () => {
            const openStatuses = [
                {
                    visitVisitorId: 'vv1',
                    visitId: 'visit1',
                    visitorId: 'vis1',
                    currentStatus: VisitorStatus.Arrived,
                    visitVisitor: { id: 'vv1' },
                },
            ];
            const statusQb = createMockQueryBuilder(openStatuses);
            mockStatusRepo.createQueryBuilder.mockReturnValue(statusQb);
            mockDs._qrManager.save.mockRejectedValueOnce(new Error('DB error'));

            await expect(service.autoCheckOutExpiredVisitors()).rejects.toThrow('DB error');
            expect(mockDs._queryRunner.rollbackTransaction).toHaveBeenCalled();
            expect(mockDs._queryRunner.release).toHaveBeenCalled();
        });

        it('should filter by Arrived and CheckedIn statuses only', async () => {
            const statusQb = createMockQueryBuilder([], 0);
            mockStatusRepo.createQueryBuilder.mockReturnValue(statusQb);

            await service.autoCheckOutExpiredVisitors();

            expect(statusQb.where).toHaveBeenCalledWith(
                's.currentStatus IN (:...statuses)',
                { statuses: [VisitorStatus.Arrived, VisitorStatus.CheckedIn] },
            );
        });

        it('should filter by visits whose plannedEndTimeUtc has passed', async () => {
            const statusQb = createMockQueryBuilder([], 0);
            mockStatusRepo.createQueryBuilder.mockReturnValue(statusQb);

            await service.autoCheckOutExpiredVisitors();

            expect(statusQb.andWhere).toHaveBeenCalledWith(
                'v.plannedEndTimeUtc <= :now',
                expect.objectContaining({ now: expect.any(Date) }),
            );
        });
    });
});
