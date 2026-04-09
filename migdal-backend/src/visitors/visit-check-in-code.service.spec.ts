import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
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
    let mockDs: ReturnType<typeof createMockDataSource>;
    let mockWs: ReturnType<typeof createMockWsGateway>;
    let mockAudit: ReturnType<typeof createMockAuditService>;
    let mockSms: { triggerSms: jest.Mock };
    let mockEmail: { triggerEmail: jest.Mock };

    const mockVisit: Partial<Visit> = {
        id: 'visit-1',
        title: 'Meeting',
        plannedStartTimeUtc: new Date('2026-04-01T09:00:00Z'),
        plannedEndTimeUtc: new Date('2026-04-01T11:00:00Z'),
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
        mockDs = createMockDataSource();
        mockWs = createMockWsGateway();
        mockAudit = createMockAuditService();
        mockSms = { triggerSms: jest.fn().mockResolvedValue(undefined) };
        mockEmail = { triggerEmail: jest.fn().mockResolvedValue(undefined) };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                VisitCheckInCodeService,
                { provide: getRepositoryToken(VisitVisitorCheckInCode), useValue: mockCodeRepo },
                { provide: getRepositoryToken(VisitVisitor), useValue: mockVvRepo },
                { provide: getRepositoryToken(VisitVisitorStatus), useValue: mockStatusRepo },
                { provide: getRepositoryToken(Visit), useValue: mockVisitRepo },
                { provide: getRepositoryToken(Visitor), useValue: mockVisitorRepo },
                { provide: DataSource, useValue: mockDs },
                { provide: UsersGateway, useValue: mockWs },
                { provide: SmsNotificationService, useValue: mockSms },
                { provide: EmailNotificationService, useValue: mockEmail },
                { provide: AuditService, useValue: mockAudit },
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

    // ── Kiosk Check-In ──

    describe('consumeCodeAndCheckIn', () => {
        it('should mark code as used and update visitor status', async () => {
            const mockStatus = {
                visitVisitorId: 'vv-1',
                currentStatus: VisitorStatus.Pending,
                arrivedAtUtc: null,
                checkedInAtUtc: null,
            };
            const qrManagerQb = createMockQueryBuilder([{ ...mockCodeRecord }]);
            mockDs._qrManager.createQueryBuilder = jest.fn().mockReturnValue(qrManagerQb);
            mockDs._qrManager.findOne.mockResolvedValue(mockStatus);
            mockVisitorRepo.findOne.mockResolvedValue(mockVisitor);
            mockVisitRepo.findOne.mockResolvedValue(mockVisit);

            const result = await service.consumeCodeAndCheckIn('012345');

            expect(result.visitorName).toBe('Jane Doe');
            expect(result.visitTitle).toBe('Meeting');
            expect(mockDs._queryRunner.commitTransaction).toHaveBeenCalled();
            // Verify code was marked as used
            expect(mockDs._qrManager.save).toHaveBeenCalledWith(
                expect.objectContaining({ usedAtUtc: expect.any(Date) }),
            );
            // Verify status was updated
            expect(mockDs._qrManager.save).toHaveBeenCalledWith(
                expect.objectContaining({ currentStatus: VisitorStatus.CheckedIn }),
            );
            expect(mockWs.broadcastToAll).toHaveBeenCalledWith(
                'visits:visitor:self-checked-in',
                expect.objectContaining({ visitVisitorId: 'vv-1' }),
            );
            expect(mockAudit.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'KIOSK_CHECK_IN' }),
            );
        });

        it('should throw BadRequestException for invalid code', async () => {
            const qrManagerQb = createMockQueryBuilder([]);
            qrManagerQb.getOne.mockResolvedValue(null);
            mockDs._qrManager.createQueryBuilder = jest.fn().mockReturnValue(qrManagerQb);

            await expect(service.consumeCodeAndCheckIn('999999')).rejects.toThrow(BadRequestException);
            expect(mockDs._queryRunner.rollbackTransaction).toHaveBeenCalled();
        });

        it('should rollback transaction on error', async () => {
            const qrManagerQb = createMockQueryBuilder([{ ...mockCodeRecord }]);
            mockDs._qrManager.createQueryBuilder = jest.fn().mockReturnValue(qrManagerQb);
            mockDs._qrManager.save.mockRejectedValueOnce(new Error('DB error'));

            await expect(service.consumeCodeAndCheckIn('012345')).rejects.toThrow('DB error');
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
});
