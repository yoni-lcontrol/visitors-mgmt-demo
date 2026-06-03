import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { VisitCheckInCodeService } from './visit-check-in-code.service';
import { VisitVisitorCheckInCode } from './entities/visit-visitor-check-in-code.entity';
import { VisitVisitor } from './entities/visit-visitor.entity';
import { VisitVisitorStatus } from './entities/visit-visitor-status.entity';
import { Visit } from './entities/visit.entity';
import { Visitor } from './entities/visitor.entity';
import { VisitorStatus } from './enums/visitor-status.enum';
import { UsersGateway } from '../websocket/gateways/users.gateway';
import { SmsNotificationService } from '../settings/sms-notification.service';
import { EmailNotificationService } from '../settings/email-notification.service';
import { AuditService } from '../audit/audit.service';
import { NotificationEvent } from '../settings/enums/notification-event.enum';
import { AmadeusUsersService } from '../amadeus/services/amadeus-users.service';
import { PrintingService } from '../printing/services/printing.service';
import { Building } from '../buildings/entities/building.entity';
import { BlacklistService } from './blacklist.service';
import { BlacklistOverrideRequest } from './entities/blacklist-override-request.entity';
import { BlacklistOverrideStatus } from './enums/blacklist-override-status.enum';
import {
    createMockRepository,
    createMockQueryBuilder,
    createMockWsGateway,
    createMockDataSource,
    createMockAuditService,
} from '../test-utils/mock.factory';

describe('VisitCheckInCodeService', () => {
    let service: VisitCheckInCodeService;
    let mockCodeRepo: ReturnType<typeof createMockRepository>;
    let mockVvRepo: ReturnType<typeof createMockRepository>;
    let mockStatusRepo: ReturnType<typeof createMockRepository>;
    let mockVisitRepo: ReturnType<typeof createMockRepository>;
    let mockVisitorRepo: ReturnType<typeof createMockRepository>;
    let mockBuildingRepo: ReturnType<typeof createMockRepository>;
    let mockDs: ReturnType<typeof createMockDataSource>;
    let mockWs: ReturnType<typeof createMockWsGateway>;
    let mockAudit: ReturnType<typeof createMockAuditService>;
    let mockSms: { triggerSms: jest.Mock };
    let mockEmail: { triggerEmail: jest.Mock };
    let mockAmadeusUsers: { addUserToAmadeus: jest.Mock; deleteUserFromAmadeus: jest.Mock };
    let mockPrinting: { requestKioskPrintCard: jest.Mock };
    let mockBlacklistService: { checkBlacklistStatus: jest.Mock };
    let mockOverrideRepo: ReturnType<typeof createMockRepository>;

    const now = new Date();
    const mockVisit: Partial<Visit> = {
        id: 'visit-1',
        title: 'Meeting',
        plannedStartTimeUtc: new Date(
            now.getFullYear(), now.getMonth(), now.getDate(),
            now.getHours() - 1, 0, 0,
        ),
        plannedEndTimeUtc: new Date(
            now.getFullYear(), now.getMonth(), now.getDate(),
            now.getHours() + 2, 0, 0,
        ),
        visitRequesterFirstName: 'Host',
        visitRequesterLastName: 'User',
        siteId: 'site-a',
        purposeOfVisit: 'Test meeting',
        isActive: true,
    };

    const mockVisitor: Partial<Visitor> = {
        id: 'visitor-1',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        phone: '+972501234567',
        personId: '123456789',
        carNumber: '12-345-67',
        isActive: true,
    };

    const mockVV: Partial<VisitVisitor> = {
        id: 'vv-1',
        visitId: 'visit-1',
        visitorId: 'visitor-1',
        isActive: true,
    };

    const mockCodeRecord: Partial<VisitVisitorCheckInCode> = {
        id: 'code-1',
        visitVisitorId: 'vv-1',
        visitId: 'visit-1',
        visitorId: 'visitor-1',
        code: '012345',
        validFromUtc: new Date(Date.now() - 3600_000),
        validToUtc: new Date(Date.now() + 3600_000),
        usedAtUtc: null,
        isActive: true,
        sentBySms: false,
        sentByEmail: false,
        lastSentAtUtc: null,
    };

    beforeEach(async () => {
        mockCodeRepo = createMockRepository();
        mockVvRepo = createMockRepository();
        mockStatusRepo = createMockRepository();
        mockVisitRepo = createMockRepository();
        mockVisitorRepo = createMockRepository();
        mockBuildingRepo = createMockRepository();
        mockDs = createMockDataSource();
        mockWs = createMockWsGateway();
        mockAudit = createMockAuditService();
        mockSms = { triggerSms: jest.fn().mockResolvedValue(undefined) };
        mockEmail = { triggerEmail: jest.fn().mockResolvedValue(undefined) };
        mockAmadeusUsers = {
            addUserToAmadeus: jest.fn().mockResolvedValue({ success: true, cardholderId: 'ch-1' }),
            deleteUserFromAmadeus: jest.fn().mockResolvedValue({ success: true }),
        };
        mockPrinting = {
            requestKioskPrintCard: jest.fn().mockResolvedValue({ ok: true, correlationId: 'corr-1', status: 'queued' }),
        };
        mockBlacklistService = {
            checkBlacklistStatus: jest.fn().mockResolvedValue({ isBlacklisted: false }),
        };
        mockOverrideRepo = createMockRepository();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                VisitCheckInCodeService,
                { provide: getRepositoryToken(VisitVisitorCheckInCode), useValue: mockCodeRepo },
                { provide: getRepositoryToken(VisitVisitor), useValue: mockVvRepo },
                { provide: getRepositoryToken(VisitVisitorStatus), useValue: mockStatusRepo },
                { provide: getRepositoryToken(Visit), useValue: mockVisitRepo },
                { provide: getRepositoryToken(Visitor), useValue: mockVisitorRepo },
                { provide: getRepositoryToken(Building), useValue: mockBuildingRepo },
                { provide: DataSource, useValue: mockDs },
                { provide: UsersGateway, useValue: mockWs },
                { provide: SmsNotificationService, useValue: mockSms },
                { provide: EmailNotificationService, useValue: mockEmail },
                { provide: AuditService, useValue: mockAudit },
                { provide: AmadeusUsersService, useValue: mockAmadeusUsers },
                { provide: PrintingService, useValue: mockPrinting },
                { provide: BlacklistService, useValue: mockBlacklistService },
                { provide: getRepositoryToken(BlacklistOverrideRequest), useValue: mockOverrideRepo },
            ],
        }).compile();

        service = module.get<VisitCheckInCodeService>(VisitCheckInCodeService);
    });

    // ── Code Generation ──

    describe('generateUniqueCode', () => {
        it('should generate a 6-digit numeric code string', async () => {
            const noConflictQb = createMockQueryBuilder([], 0);
            noConflictQb.getExists.mockResolvedValue(false);
            mockCodeRepo.createQueryBuilder.mockReturnValue(noConflictQb);

            const code = await service.generateUniqueCode(
                new Date('2026-04-01T08:00:00Z'),
                new Date('2026-04-01T11:00:00Z'),
            );

            expect(code).toMatch(/^\d{6}$/);
            expect(code.length).toBe(6);
        });

        it('should retry on overlap collision and succeed', async () => {
            // First attempt conflicts, second succeeds
            const qb = createMockQueryBuilder([], 0);
            qb.getExists
                .mockResolvedValueOnce(true) // first attempt: conflict
                .mockResolvedValueOnce(false); // second attempt: no conflict
            mockCodeRepo.createQueryBuilder.mockReturnValue(qb);

            const code = await service.generateUniqueCode(
                new Date('2026-04-01T08:00:00Z'),
                new Date('2026-04-01T11:00:00Z'),
            );

            expect(code).toMatch(/^\d{6}$/);
            expect(qb.getExists).toHaveBeenCalledTimes(2);
        });

        it('should throw ConflictException after max retries', async () => {
            const qb = createMockQueryBuilder([], 0);
            qb.getExists.mockResolvedValue(true); // always conflicts
            mockCodeRepo.createQueryBuilder.mockReturnValue(qb);

            await expect(
                service.generateUniqueCode(
                    new Date('2026-04-01T08:00:00Z'),
                    new Date('2026-04-01T11:00:00Z'),
                ),
            ).rejects.toThrow(ConflictException);
        });
    });

    describe('generateCodesForVisit', () => {
        it('should generate codes for all visitors in a visit', async () => {
            mockVisitRepo.findOne.mockResolvedValue(mockVisit);
            mockVvRepo.find.mockResolvedValue([mockVV]);
            mockCodeRepo.findOne.mockResolvedValue(null); // no existing code

            const noConflictQb = createMockQueryBuilder([], 0);
            noConflictQb.getExists.mockResolvedValue(false);
            mockCodeRepo.createQueryBuilder.mockReturnValue(noConflictQb);
            mockCodeRepo.save.mockImplementation((entity: any) =>
                Promise.resolve({ id: 'new-code-id', ...entity }),
            );

            const codes = await service.generateCodesForVisit('visit-1', 'user-1');

            expect(codes).toHaveLength(1);
            expect(codes[0].visitVisitorId).toBe('vv-1');
            expect(codes[0].code).toMatch(/^\d{6}$/);
            expect(mockAudit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'GENERATE_CHECK_IN_CODES' }),
            );
            expect(mockWs.broadcastToAll).toHaveBeenCalledWith(
                'visits:check-in-code:generated',
                expect.objectContaining({ visitId: 'visit-1' }),
            );
        });

        it('should skip generation if active code already exists', async () => {
            mockVisitRepo.findOne.mockResolvedValue(mockVisit);
            mockVvRepo.find.mockResolvedValue([mockVV]);
            mockCodeRepo.findOne.mockResolvedValue(mockCodeRecord); // existing code

            const codes = await service.generateCodesForVisit('visit-1', 'user-1');

            expect(codes).toHaveLength(1);
            expect(codes[0]).toEqual(mockCodeRecord);
        });

        it('should throw NotFoundException if visit not found', async () => {
            mockVisitRepo.findOne.mockResolvedValue(null);
            await expect(service.generateCodesForVisit('bad-id')).rejects.toThrow(NotFoundException);
        });
    });

    // ── Kiosk Validation ──

    describe('validateCode', () => {
        it('should return valid=true for a valid active code', async () => {
            const qb = createMockQueryBuilder([mockCodeRecord]);
            mockCodeRepo.createQueryBuilder.mockReturnValue(qb);
            mockVisitorRepo.findOne.mockResolvedValue(mockVisitor);
            mockVisitRepo.findOne.mockResolvedValue(mockVisit);

            const result = await service.validateCode('012345');

            expect(result.valid).toBe(true);
            expect(result.visitorName).toBe('Jane Doe');
            expect(result.visitTitle).toBe('Meeting');
        });

        it('should return valid=false for non-existent code', async () => {
            const qb = createMockQueryBuilder([]);
            qb.getOne.mockResolvedValue(null);
            mockCodeRepo.createQueryBuilder.mockReturnValue(qb);

            const result = await service.validateCode('999999');

            expect(result.valid).toBe(false);
        });
    });

    // ── Kiosk Arrive ──

    describe('consumeCodeAndArrive', () => {
        it('should mark code as used and update visitor status', async () => {
            const mockStatus = {
                visitVisitorId: 'vv-1',
                currentStatus: VisitorStatus.Pending,
                arrivedAtUtc: null,
                checkedInAtUtc: null,
            };
            const qrManagerQb = createMockQueryBuilder([{ ...mockCodeRecord }]);
            mockDs._qrManager.createQueryBuilder = jest.fn().mockReturnValue(qrManagerQb);
            mockDs._qrManager.findOne
                .mockResolvedValueOnce(null)       // BlacklistOverrideRequest — no pending override
                .mockResolvedValueOnce(mockVisit)  // Visit for time validation
                .mockResolvedValueOnce(mockStatus); // VisitVisitorStatus
            mockVisitorRepo.findOne.mockResolvedValue(mockVisitor);
            mockVisitRepo.findOne.mockResolvedValue(mockVisit);

            const result = await service.consumeCodeAndArrive('012345');

            expect(result.visitorName).toBe('Jane Doe');
            expect(result.visitTitle).toBe('Meeting');
            expect(mockDs._queryRunner.commitTransaction).toHaveBeenCalled();
            // Verify code was marked as used
            expect(mockDs._qrManager.save).toHaveBeenCalledWith(
                expect.objectContaining({ usedAtUtc: expect.any(Date) }),
            );
            // Verify status was updated
            expect(mockDs._qrManager.save).toHaveBeenCalledWith(
                expect.objectContaining({ currentStatus: VisitorStatus.Arrived }),
            );
            expect(mockWs.broadcastToAll).toHaveBeenCalledWith(
                'visits:visitor:arrived',
                expect.objectContaining({ visitVisitorId: 'vv-1' }),
            );
            expect(mockAudit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'KIOSK_ARRIVED' }),
            );
        });

        it('should send VisitorArrived SMS and email notifications after arrival', async () => {
            const mockStatus = {
                visitVisitorId: 'vv-1',
                currentStatus: VisitorStatus.Pending,
                arrivedAtUtc: null,
                checkedInAtUtc: null,
            };
            const qrManagerQb = createMockQueryBuilder([{ ...mockCodeRecord }]);
            mockDs._qrManager.createQueryBuilder = jest.fn().mockReturnValue(qrManagerQb);
            mockDs._qrManager.findOne
                .mockResolvedValueOnce(null)       // BlacklistOverrideRequest — no pending override
                .mockResolvedValueOnce(mockVisit)  // Visit for time validation
                .mockResolvedValueOnce(mockStatus); // VisitVisitorStatus
            mockVisitorRepo.findOne.mockResolvedValue(mockVisitor);
            mockVisitRepo.findOne.mockResolvedValue({ ...mockVisit, visitRequesterUser: null });
            mockBuildingRepo.findOne.mockResolvedValue(null);

            await service.consumeCodeAndArrive('012345');

            expect(mockSms.triggerSms).toHaveBeenCalledWith(
                NotificationEvent.VisitorArrived,
                expect.objectContaining({
                    visit: expect.objectContaining({ title: 'Meeting' }),
                    visitor: expect.objectContaining({ firstName: 'Jane', lastName: 'Doe' }),
                }),
            );
            expect(mockEmail.triggerEmail).toHaveBeenCalledWith(
                NotificationEvent.VisitorArrived,
                expect.objectContaining({
                    visit: expect.objectContaining({ title: 'Meeting' }),
                    visitor: expect.objectContaining({ firstName: 'Jane', lastName: 'Doe' }),
                }),
            );
        });

        it('should throw BadRequestException for invalid code', async () => {
            const qrManagerQb = createMockQueryBuilder([]);
            qrManagerQb.getOne.mockResolvedValue(null);
            mockDs._qrManager.createQueryBuilder = jest.fn().mockReturnValue(qrManagerQb);

            await expect(service.consumeCodeAndArrive('999999')).rejects.toThrow(BadRequestException);
            expect(mockDs._queryRunner.rollbackTransaction).toHaveBeenCalled();
        });

        it('should rollback transaction on error', async () => {
            const qrManagerQb = createMockQueryBuilder([{ ...mockCodeRecord }]);
            mockDs._qrManager.createQueryBuilder = jest.fn().mockReturnValue(qrManagerQb);
            mockDs._qrManager.findOne
                .mockResolvedValueOnce(null)       // no pending override
                .mockResolvedValueOnce(mockVisit); // Visit for time validation
            mockDs._qrManager.save.mockRejectedValueOnce(new Error('DB error'));

            await expect(service.consumeCodeAndArrive('012345')).rejects.toThrow('DB error');
            expect(mockDs._queryRunner.rollbackTransaction).toHaveBeenCalled();
        });

        it('should throw ForbiddenException when visitor has pending blacklist override', async () => {
            const qrManagerQb = createMockQueryBuilder([{ ...mockCodeRecord }]);
            mockDs._qrManager.createQueryBuilder = jest.fn().mockReturnValue(qrManagerQb);
            mockDs._qrManager.findOne.mockResolvedValueOnce({ id: 'override-1', visitVisitorId: 'vv-1', status: 'pending' });

            await expect(service.consumeCodeAndArrive('012345')).rejects.toThrow(ForbiddenException);
            expect(mockDs._queryRunner.rollbackTransaction).toHaveBeenCalled();
        });
    });

    // ── Resend ──

    describe('resendCode', () => {
        it('should resend code to visitor with phone and email', async () => {
            mockCodeRepo.findOne.mockResolvedValue({ ...mockCodeRecord });
            mockVisitRepo.findOne.mockResolvedValue(mockVisit);
            mockVisitorRepo.findOne.mockResolvedValue(mockVisitor);
            mockCodeRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));

            const result = await service.resendCode('vv-1', 'user-1');

            expect(result.sent).toBe(true);
            expect(mockSms.triggerSms).toHaveBeenCalled();
            expect(mockEmail.triggerEmail).toHaveBeenCalled();
            expect(mockAudit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'RESEND_CHECK_IN_CODE' }),
            );
        });

        it('should throw NotFoundException when no active code exists', async () => {
            mockCodeRepo.findOne.mockResolvedValue(null);
            await expect(service.resendCode('vv-bad')).rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException when code already used', async () => {
            mockCodeRepo.findOne.mockResolvedValue({
                ...mockCodeRecord,
                usedAtUtc: new Date(),
            });
            await expect(service.resendCode('vv-1')).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException when code expired', async () => {
            mockCodeRepo.findOne.mockResolvedValue({
                ...mockCodeRecord,
                validToUtc: new Date('2020-01-01'),
            });
            await expect(service.resendCode('vv-1')).rejects.toThrow(BadRequestException);
        });
    });

    // ── Regenerate ──

    describe('regenerateCode', () => {
        it('should deactivate old code and create new one', async () => {
            mockVvRepo.findOne.mockResolvedValue(mockVV);
            mockVisitRepo.findOne.mockResolvedValue(mockVisit);
            mockVisitorRepo.findOne.mockResolvedValue(mockVisitor);

            const deactivateQb = createMockQueryBuilder([], 0);
            const noConflictQb = createMockQueryBuilder([], 0);
            noConflictQb.getExists.mockResolvedValue(false);
            mockCodeRepo.createQueryBuilder
                .mockReturnValueOnce(deactivateQb) // for deactivation update
                .mockReturnValueOnce(noConflictQb); // for uniqueness check in generate
            mockCodeRepo.save.mockImplementation((entity: any) =>
                Promise.resolve({ id: 'new-code-id', ...entity }),
            );

            const newCode = await service.regenerateCode('vv-1', 'user-1');

            expect(newCode.code).toMatch(/^\d{6}$/);
            expect(newCode.visitVisitorId).toBe('vv-1');
            expect(deactivateQb.execute).toHaveBeenCalled();
            expect(mockAudit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'REGENERATE_CHECK_IN_CODE' }),
            );
            expect(mockWs.broadcastToAll).toHaveBeenCalledWith(
                'visits:check-in-code:regenerated',
                expect.objectContaining({ visitVisitorId: 'vv-1' }),
            );
        });

        it('should throw NotFoundException if visit-visitor not found', async () => {
            mockVvRepo.findOne.mockResolvedValue(null);
            await expect(service.regenerateCode('bad-vv')).rejects.toThrow(NotFoundException);
        });

        it('should throw NotFoundException if visit not found', async () => {
            mockVvRepo.findOne.mockResolvedValue(mockVV);
            mockVisitRepo.findOne.mockResolvedValue(null);
            await expect(service.regenerateCode('vv-1')).rejects.toThrow(NotFoundException);
        });
    });

    // ── Query Helpers ──

    describe('getCodesForVisit', () => {
        it('should return codes ordered by createdAt DESC', async () => {
            mockCodeRepo.find.mockResolvedValue([mockCodeRecord]);
            const result = await service.getCodesForVisit('visit-1');
            expect(result).toHaveLength(1);
            expect(mockCodeRepo.find).toHaveBeenCalledWith({
                where: { visitId: 'visit-1' },
                order: { createdAt: 'DESC' },
            });
        });
    });

    describe('getActiveCodeForVisitVisitor', () => {
        it('should return active code for visit-visitor', async () => {
            mockCodeRepo.findOne.mockResolvedValue(mockCodeRecord);
            const result = await service.getActiveCodeForVisitVisitor('vv-1');
            expect(result).toEqual(mockCodeRecord);
        });

        it('should return null when no active code exists', async () => {
            mockCodeRepo.findOne.mockResolvedValue(null);
            const result = await service.getActiveCodeForVisitVisitor('vv-1');
            expect(result).toBeNull();
        });
    });

    // ── arriveByPersonId ──

    describe('arriveByPersonId', () => {
        it('should send VisitorArrived SMS and email notifications on arrival', async () => {
            mockVisitorRepo.findOne.mockResolvedValue(mockVisitor);
            mockVvRepo.findOne.mockResolvedValue({ ...mockVV, visit: { ...mockVisit, visitRequesterUser: null } });
            mockStatusRepo.findOne.mockResolvedValue({
                visitVisitorId: 'vv-1',
                currentStatus: VisitorStatus.Pending,
                arrivedAtUtc: null,
            });
            mockStatusRepo.save.mockImplementation((e: any) => Promise.resolve(e));
            mockBuildingRepo.findOne.mockResolvedValue(null);
            mockAmadeusUsers.addUserToAmadeus.mockResolvedValue({ cardholderId: 'ch-1' });

            const result = await service.arriveByPersonId('visit-1', 'visitor-1', '123456789');

            expect(result.ok).toBe(true);
            expect(mockSms.triggerSms).toHaveBeenCalledWith(
                NotificationEvent.VisitorArrived,
                expect.objectContaining({
                    visit: expect.objectContaining({ title: 'Meeting' }),
                    visitor: expect.objectContaining({ firstName: 'Jane', lastName: 'Doe' }),
                }),
            );
            expect(mockEmail.triggerEmail).toHaveBeenCalledWith(
                NotificationEvent.VisitorArrived,
                expect.objectContaining({
                    visit: expect.objectContaining({ title: 'Meeting' }),
                    visitor: expect.objectContaining({ firstName: 'Jane', lastName: 'Doe' }),
                }),
            );
        });

        it('should not block arrival if notification fails', async () => {
            mockVisitorRepo.findOne.mockResolvedValue(mockVisitor);
            mockVvRepo.findOne.mockResolvedValue({ ...mockVV, visit: { ...mockVisit, visitRequesterUser: null } });
            mockStatusRepo.findOne.mockResolvedValue({
                visitVisitorId: 'vv-1',
                currentStatus: VisitorStatus.Pending,
                arrivedAtUtc: null,
            });
            mockStatusRepo.save.mockImplementation((e: any) => Promise.resolve(e));
            mockBuildingRepo.findOne.mockResolvedValue(null);
            mockAmadeusUsers.addUserToAmadeus.mockResolvedValue({ cardholderId: 'ch-1' });
            mockSms.triggerSms.mockRejectedValue(new Error('SMS service down'));
            mockEmail.triggerEmail.mockRejectedValue(new Error('Email service down'));

            const result = await service.arriveByPersonId('visit-1', 'visitor-1', '123456789');

            expect(result.ok).toBe(true);
        });

        it('should throw BadRequestException if visitor not found', async () => {
            mockVisitorRepo.findOne.mockResolvedValue(null);

            await expect(
                service.arriveByPersonId('visit-1', 'visitor-1', '123456789'),
            ).rejects.toThrow(BadRequestException);
        });
    });

    // ── Notification Integration ──

    describe('sendCodeNotifications', () => {
        it('should send SMS and email for visitor with both contact methods', async () => {
            mockVisitRepo.findOne.mockResolvedValue(mockVisit);
            mockCodeRepo.find.mockResolvedValue([{ ...mockCodeRecord }]);
            mockVisitorRepo.findOne.mockResolvedValue(mockVisitor);
            mockCodeRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));

            const result = await service.sendCodeNotifications('visit-1', 'user-1');

            expect(result.smsSent).toBe(1);
            expect(result.emailSent).toBe(1);
        });

        it('should skip used codes', async () => {
            mockVisitRepo.findOne.mockResolvedValue(mockVisit);
            mockCodeRepo.find.mockResolvedValue([{ ...mockCodeRecord, usedAtUtc: new Date() }]);

            const result = await service.sendCodeNotifications('visit-1');

            expect(result.smsSent).toBe(0);
            expect(result.emailSent).toBe(0);
        });

        it('should handle visitor without phone (email only)', async () => {
            mockVisitRepo.findOne.mockResolvedValue(mockVisit);
            mockCodeRepo.find.mockResolvedValue([{ ...mockCodeRecord }]);
            mockVisitorRepo.findOne.mockResolvedValue({ ...mockVisitor, phone: null });
            mockCodeRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));

            const result = await service.sendCodeNotifications('visit-1');

            expect(result.smsSent).toBe(0);
            expect(result.emailSent).toBe(1);
        });

        it('should throw NotFoundException if visit not found', async () => {
            mockVisitRepo.findOne.mockResolvedValue(null);
            await expect(service.sendCodeNotifications('bad-id')).rejects.toThrow(NotFoundException);
        });
    });

    // ── Visit Time Validation ──

    describe('visit time validation', () => {
        describe('arriveByPersonId - date validation', () => {
            it('should reject when visit has not started yet (future date)', async () => {
                const futureVisit = {
                    ...mockVisit,
                    plannedStartTimeUtc: new Date(Date.now() + 86400_000 * 2), // 2 days from now
                    plannedEndTimeUtc: new Date(Date.now() + 86400_000 * 3),
                    visitRequesterUser: null,
                };
                mockVisitorRepo.findOne.mockResolvedValue(mockVisitor);
                mockVvRepo.findOne.mockResolvedValue({ ...mockVV, visit: futureVisit });

                await expect(
                    service.arriveByPersonId('visit-1', 'visitor-1', '123456789'),
                ).rejects.toThrow(BadRequestException);

                await expect(
                    service.arriveByPersonId('visit-1', 'visitor-1', '123456789'),
                ).rejects.toThrow('Invitation has not started yet');
            });

            it('should reject when visit has expired (past date)', async () => {
                const expiredVisit = {
                    ...mockVisit,
                    plannedStartTimeUtc: new Date(Date.now() - 86400_000 * 3),
                    plannedEndTimeUtc: new Date(Date.now() - 86400_000 * 2),
                    visitRequesterUser: null,
                };
                mockVisitorRepo.findOne.mockResolvedValue(mockVisitor);
                mockVvRepo.findOne.mockResolvedValue({ ...mockVV, visit: expiredVisit });

                await expect(
                    service.arriveByPersonId('visit-1', 'visitor-1', '123456789'),
                ).rejects.toThrow(BadRequestException);

                await expect(
                    service.arriveByPersonId('visit-1', 'visitor-1', '123456789'),
                ).rejects.toThrow('Invitation has expired');
            });

            it('should allow multi-day visit on a middle day within time window', async () => {
                const now = new Date();
                const multiDayVisit = {
                    ...mockVisit,
                    // Start yesterday at current hour - 1
                    plannedStartTimeUtc: new Date(
                        now.getFullYear(), now.getMonth(), now.getDate() - 1,
                        now.getHours() - 1, 0, 0,
                    ),
                    // End tomorrow at current hour + 1
                    plannedEndTimeUtc: new Date(
                        now.getFullYear(), now.getMonth(), now.getDate() + 1,
                        now.getHours() + 1, 0, 0,
                    ),
                    visitRequesterUser: null,
                };
                mockVisitorRepo.findOne.mockResolvedValue(mockVisitor);
                mockVvRepo.findOne.mockResolvedValue({ ...mockVV, visit: multiDayVisit });
                mockStatusRepo.findOne.mockResolvedValue({
                    visitVisitorId: 'vv-1',
                    currentStatus: 0,
                    arrivedAtUtc: null,
                });
                mockStatusRepo.save.mockImplementation((e: any) => Promise.resolve(e));

                const result = await service.arriveByPersonId('visit-1', 'visitor-1', '123456789');
                expect(result.ok).toBe(true);
            });
        });

        describe('arriveByPersonId - time-of-day validation', () => {
            it('should reject when current time is before visit start time (same day)', async () => {
                const now = new Date();
                // Start time 3 hours from now, same day
                const laterTodayVisit = {
                    ...mockVisit,
                    plannedStartTimeUtc: new Date(
                        now.getFullYear(), now.getMonth(), now.getDate(),
                        now.getHours() + 3, 0, 0,
                    ),
                    plannedEndTimeUtc: new Date(
                        now.getFullYear(), now.getMonth(), now.getDate(),
                        now.getHours() + 5, 0, 0,
                    ),
                    visitRequesterUser: null,
                };
                mockVisitorRepo.findOne.mockResolvedValue(mockVisitor);
                mockVvRepo.findOne.mockResolvedValue({ ...mockVV, visit: laterTodayVisit });

                await expect(
                    service.arriveByPersonId('visit-1', 'visitor-1', '123456789'),
                ).rejects.toThrow('Invitation time is not valid now');
            });

            it('should reject when current time is after visit end time (same day)', async () => {
                const now = new Date();
                // End time 3 hours ago, start time 5 hours ago
                const pastTodayVisit = {
                    ...mockVisit,
                    plannedStartTimeUtc: new Date(
                        now.getFullYear(), now.getMonth(), now.getDate(),
                        now.getHours() - 5, 0, 0,
                    ),
                    plannedEndTimeUtc: new Date(
                        now.getFullYear(), now.getMonth(), now.getDate(),
                        now.getHours() - 3, 0, 0,
                    ),
                    visitRequesterUser: null,
                };
                mockVisitorRepo.findOne.mockResolvedValue(mockVisitor);
                mockVvRepo.findOne.mockResolvedValue({ ...mockVV, visit: pastTodayVisit });

                await expect(
                    service.arriveByPersonId('visit-1', 'visitor-1', '123456789'),
                ).rejects.toThrow('Invitation time is not valid now');
            });

            it('should allow when current time exactly equals start time', async () => {
                const now = new Date();
                const exactStartVisit = {
                    ...mockVisit,
                    plannedStartTimeUtc: new Date(
                        now.getFullYear(), now.getMonth(), now.getDate(),
                        now.getHours(), now.getMinutes(), 0,
                    ),
                    plannedEndTimeUtc: new Date(
                        now.getFullYear(), now.getMonth(), now.getDate(),
                        now.getHours() + 2, now.getMinutes(), 0,
                    ),
                    visitRequesterUser: null,
                };
                mockVisitorRepo.findOne.mockResolvedValue(mockVisitor);
                mockVvRepo.findOne.mockResolvedValue({ ...mockVV, visit: exactStartVisit });
                mockStatusRepo.findOne.mockResolvedValue({
                    visitVisitorId: 'vv-1',
                    currentStatus: 0,
                    arrivedAtUtc: null,
                });
                mockStatusRepo.save.mockImplementation((e: any) => Promise.resolve(e));

                const result = await service.arriveByPersonId('visit-1', 'visitor-1', '123456789');
                expect(result.ok).toBe(true);
            });

            it('should allow when current time exactly equals end time', async () => {
                const now = new Date();
                const exactEndVisit = {
                    ...mockVisit,
                    plannedStartTimeUtc: new Date(
                        now.getFullYear(), now.getMonth(), now.getDate(),
                        now.getHours() - 2, now.getMinutes(), 0,
                    ),
                    plannedEndTimeUtc: new Date(
                        now.getFullYear(), now.getMonth(), now.getDate(),
                        now.getHours(), now.getMinutes(), 0,
                    ),
                    visitRequesterUser: null,
                };
                mockVisitorRepo.findOne.mockResolvedValue(mockVisitor);
                mockVvRepo.findOne.mockResolvedValue({ ...mockVV, visit: exactEndVisit });
                mockStatusRepo.findOne.mockResolvedValue({
                    visitVisitorId: 'vv-1',
                    currentStatus: 0,
                    arrivedAtUtc: null,
                });
                mockStatusRepo.save.mockImplementation((e: any) => Promise.resolve(e));

                const result = await service.arriveByPersonId('visit-1', 'visitor-1', '123456789');
                expect(result.ok).toBe(true);
            });

            it('should allow when plannedEndTimeUtc is null (open-ended)', async () => {
                const now = new Date();
                const openEndedVisit = {
                    ...mockVisit,
                    plannedStartTimeUtc: new Date(
                        now.getFullYear(), now.getMonth(), now.getDate(),
                        now.getHours() - 1, 0, 0,
                    ),
                    plannedEndTimeUtc: null,
                    visitRequesterUser: null,
                };
                mockVisitorRepo.findOne.mockResolvedValue(mockVisitor);
                mockVvRepo.findOne.mockResolvedValue({ ...mockVV, visit: openEndedVisit });
                mockStatusRepo.findOne.mockResolvedValue({
                    visitVisitorId: 'vv-1',
                    currentStatus: 0,
                    arrivedAtUtc: null,
                });
                mockStatusRepo.save.mockImplementation((e: any) => Promise.resolve(e));

                const result = await service.arriveByPersonId('visit-1', 'visitor-1', '123456789');
                expect(result.ok).toBe(true);
            });
        });

        describe('consumeCodeAndArrive - time validation', () => {
            it('should reject when visit time window is invalid', async () => {
                const now = new Date();
                const expiredVisit = {
                    ...mockVisit,
                    plannedStartTimeUtc: new Date(Date.now() - 86400_000 * 3),
                    plannedEndTimeUtc: new Date(Date.now() - 86400_000 * 2),
                };
                const qrManagerQb = createMockQueryBuilder([{ ...mockCodeRecord }]);
                mockDs._qrManager.createQueryBuilder = jest.fn().mockReturnValue(qrManagerQb);
                mockDs._qrManager.findOne
                    .mockResolvedValueOnce(null)         // BlacklistOverrideRequest — no pending override
                    .mockResolvedValueOnce(expiredVisit); // Visit for time validation

                await expect(service.consumeCodeAndArrive('012345')).rejects.toThrow(BadRequestException);
                expect(mockDs._queryRunner.rollbackTransaction).toHaveBeenCalled();
            });
        });

        describe('findVisitByPersonId - time validation', () => {
            it('should return ok=false with reason when visit time is invalid', async () => {
                const now = new Date();
                // Visit that started yesterday and ended yesterday
                const expiredVisit = {
                    ...mockVisit,
                    id: 'visit-1',
                    plannedStartTimeUtc: new Date(Date.now() - 86400_000 * 3),
                    plannedEndTimeUtc: new Date(Date.now() - 86400_000 * 2),
                    isActive: true,
                };
                mockVisitorRepo.findOne.mockResolvedValue(mockVisitor);

                const vvQb = createMockQueryBuilder([{ ...mockVV, visit: expiredVisit, status: null }]);
                mockVvRepo.createQueryBuilder = jest.fn().mockReturnValue(vvQb);

                const result = await service.findVisitByPersonId('123456789');

                expect(result.ok).toBe(false);
                expect((result as any).reason).toBeDefined();
            });

            it('should return ok=true when visit time is valid', async () => {
                const now = new Date();
                const validVisit = {
                    ...mockVisit,
                    id: 'visit-1',
                    plannedStartTimeUtc: new Date(
                        now.getFullYear(), now.getMonth(), now.getDate(),
                        now.getHours() - 1, 0, 0,
                    ),
                    plannedEndTimeUtc: new Date(
                        now.getFullYear(), now.getMonth(), now.getDate(),
                        now.getHours() + 1, 0, 0,
                    ),
                    isActive: true,
                };
                mockVisitorRepo.findOne.mockResolvedValue(mockVisitor);

                const vvQb = createMockQueryBuilder([{ ...mockVV, visit: validVisit, status: null }]);
                mockVvRepo.createQueryBuilder = jest.fn().mockReturnValue(vvQb);

                const result = await service.findVisitByPersonId('123456789');

                expect(result.ok).toBe(true);
            });
        });

        describe('findVisitByPersonId - blacklist check', () => {
            const validVisit = {
                ...mockVisit,
                id: 'visit-1',
                plannedStartTimeUtc: new Date(
                    now.getFullYear(), now.getMonth(), now.getDate(),
                    now.getHours() - 1, 0, 0,
                ),
                plannedEndTimeUtc: new Date(
                    now.getFullYear(), now.getMonth(), now.getDate(),
                    now.getHours() + 1, 0, 0,
                ),
                isActive: true,
            };

            beforeEach(() => {
                mockVisitorRepo.findOne.mockResolvedValue(mockVisitor);
                const vvQb = createMockQueryBuilder([{ ...mockVV, visit: validVisit, status: null }]);
                mockVvRepo.createQueryBuilder = jest.fn().mockReturnValue(vvQb);
            });

            it('should allow non-blacklisted visitor through', async () => {
                mockBlacklistService.checkBlacklistStatus.mockResolvedValue({ isBlacklisted: false });

                const result = await service.findVisitByPersonId('123456789');
                expect(result.ok).toBe(true);
            });

            it('should block blacklisted visitor with no override', async () => {
                mockBlacklistService.checkBlacklistStatus.mockResolvedValue({ isBlacklisted: true });
                mockOverrideRepo.findOne.mockResolvedValue(null);

                const result = await service.findVisitByPersonId('123456789');
                expect(result.ok).toBe(false);
            });

            it('should block blacklisted visitor with pending override', async () => {
                mockBlacklistService.checkBlacklistStatus.mockResolvedValue({ isBlacklisted: true });
                mockOverrideRepo.findOne.mockResolvedValue({ status: BlacklistOverrideStatus.Pending, isActive: true });

                const result = await service.findVisitByPersonId('123456789');
                expect(result.ok).toBe(false);
            });

            it('should block blacklisted visitor with security escort override', async () => {
                mockBlacklistService.checkBlacklistStatus.mockResolvedValue({ isBlacklisted: true });
                mockOverrideRepo.findOne.mockResolvedValue({ status: BlacklistOverrideStatus.ApprovedSecurity, isActive: true });

                const result = await service.findVisitByPersonId('123456789');
                expect(result.ok).toBe(false);
            });

            it('should block blacklisted visitor with denied override', async () => {
                mockBlacklistService.checkBlacklistStatus.mockResolvedValue({ isBlacklisted: true });
                mockOverrideRepo.findOne.mockResolvedValue({ status: BlacklistOverrideStatus.Denied, isActive: true });

                const result = await service.findVisitByPersonId('123456789');
                expect(result.ok).toBe(false);
            });

            it('should allow blacklisted visitor with approved override', async () => {
                mockBlacklistService.checkBlacklistStatus.mockResolvedValue({ isBlacklisted: true });
                mockOverrideRepo.findOne.mockResolvedValue({ status: BlacklistOverrideStatus.Approved, isActive: true });

                const result = await service.findVisitByPersonId('123456789');
                expect(result.ok).toBe(true);
            });

            it('should allow blacklisted visitor with regular escort override', async () => {
                mockBlacklistService.checkBlacklistStatus.mockResolvedValue({ isBlacklisted: true });
                mockOverrideRepo.findOne.mockResolvedValue({ status: BlacklistOverrideStatus.ApprovedEscort, isActive: true });

                const result = await service.findVisitByPersonId('123456789');
                expect(result.ok).toBe(true);
            });
        });
    });
});
