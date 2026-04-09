import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RetentionCleanupService } from './retention-cleanup.service';
import { AuditLog } from '../common/entities/audit-log.entity';
import { Visit } from '../visitors/entities/visit.entity';
import { DeviceCommandLog } from '../device-commands/entities/device-command-log.entity';
import { SettingsService } from './settings.service';
import { createMockRepository, createMockQueryBuilder, createMockAuditService } from '../test-utils/mock.factory';
import { AuditService } from '../audit/audit.service';

describe('RetentionCleanupService', () => {
    let service: RetentionCleanupService;
    let mockAuditRepo: ReturnType<typeof createMockRepository>;
    let mockVisitRepo: ReturnType<typeof createMockRepository>;
    let mockCommandLogRepo: ReturnType<typeof createMockRepository>;
    let mockSettingsService: { getValue: jest.Mock };
    let mockAuditService: ReturnType<typeof createMockAuditService>;

    beforeEach(async () => {
        mockAuditRepo = createMockRepository();
        mockVisitRepo = createMockRepository();
        mockCommandLogRepo = createMockRepository();
        mockSettingsService = { getValue: jest.fn() };
        mockAuditService = createMockAuditService();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RetentionCleanupService,
                { provide: getRepositoryToken(AuditLog), useValue: mockAuditRepo },
                { provide: getRepositoryToken(Visit), useValue: mockVisitRepo },
                { provide: getRepositoryToken(DeviceCommandLog), useValue: mockCommandLogRepo },
                { provide: SettingsService, useValue: mockSettingsService },
                { provide: AuditService, useValue: mockAuditService },
            ],
        }).compile();

        service = module.get<RetentionCleanupService>(RetentionCleanupService);
    });

    describe('parseRetentionMonths', () => {
        it('should return null for null value', () => {
            expect(service.parseRetentionMonths(null)).toBeNull();
        });

        it('should return null for empty string', () => {
            expect(service.parseRetentionMonths('')).toBeNull();
        });

        it('should return null for whitespace-only string', () => {
            expect(service.parseRetentionMonths('   ')).toBeNull();
        });

        it('should return null for zero', () => {
            expect(service.parseRetentionMonths('0')).toBeNull();
        });

        it('should return null for negative values', () => {
            expect(service.parseRetentionMonths('-5')).toBeNull();
        });

        it('should return null for non-integer values', () => {
            expect(service.parseRetentionMonths('3.5')).toBeNull();
        });

        it('should return null for non-numeric strings', () => {
            expect(service.parseRetentionMonths('abc')).toBeNull();
        });

        it('should return number for valid positive integer string', () => {
            expect(service.parseRetentionMonths('6')).toBe(6);
        });

        it('should return number for large valid value', () => {
            expect(service.parseRetentionMonths('120')).toBe(120);
        });
    });

    describe('calculateCutoffDate', () => {
        it('should subtract months from current date', () => {
            const before = new Date();
            before.setMonth(before.getMonth() - 6);

            const cutoff = service.calculateCutoffDate(6);

            // Allow 1 second tolerance
            expect(Math.abs(cutoff.getTime() - before.getTime())).toBeLessThan(1000);
        });

        it('should handle 1 month correctly', () => {
            const before = new Date();
            before.setMonth(before.getMonth() - 1);

            const cutoff = service.calculateCutoffDate(1);
            expect(Math.abs(cutoff.getTime() - before.getTime())).toBeLessThan(1000);
        });
    });

    describe('deleteOldAuditLogs', () => {
        it('should delete records in batches and return total count', async () => {
            const qb = createMockQueryBuilder();
            qb.delete = jest.fn().mockReturnThis();
            qb.where = jest.fn().mockReturnThis();
            // First batch returns 5000 (full), second returns 200 (partial = stop)
            qb.execute = jest.fn()
                .mockResolvedValueOnce({ affected: 5000 })
                .mockResolvedValueOnce({ affected: 200 });
            mockAuditRepo.createQueryBuilder.mockReturnValue(qb);

            const cutoff = new Date();
            const result = await service.deleteOldAuditLogs(cutoff);

            expect(result).toBe(5200);
            expect(qb.execute).toHaveBeenCalledTimes(2);
        });

        it('should return 0 when no records to delete', async () => {
            const qb = createMockQueryBuilder();
            qb.delete = jest.fn().mockReturnThis();
            qb.where = jest.fn().mockReturnThis();
            qb.execute = jest.fn().mockResolvedValue({ affected: 0 });
            mockAuditRepo.createQueryBuilder.mockReturnValue(qb);

            const result = await service.deleteOldAuditLogs(new Date());
            expect(result).toBe(0);
        });
    });

    describe('deleteOldVisits', () => {
        it('should delete records in batches and return total count', async () => {
            const qb = createMockQueryBuilder();
            qb.delete = jest.fn().mockReturnThis();
            qb.where = jest.fn().mockReturnThis();
            qb.execute = jest.fn()
                .mockResolvedValueOnce({ affected: 5000 })
                .mockResolvedValueOnce({ affected: 300 });
            mockVisitRepo.createQueryBuilder.mockReturnValue(qb);

            const result = await service.deleteOldVisits(new Date());
            expect(result).toBe(5300);
        });

        it('should return 0 when no records to delete', async () => {
            const qb = createMockQueryBuilder();
            qb.delete = jest.fn().mockReturnThis();
            qb.where = jest.fn().mockReturnThis();
            qb.execute = jest.fn().mockResolvedValue({ affected: 0 });
            mockVisitRepo.createQueryBuilder.mockReturnValue(qb);

            const result = await service.deleteOldVisits(new Date());
            expect(result).toBe(0);
        });
    });

    describe('handleRetentionCleanup', () => {
        it('should load settings and call cleanup methods', async () => {
            mockSettingsService.getValue
                .mockResolvedValueOnce('6')     // audit months
                .mockResolvedValueOnce('12')    // visits months
                .mockResolvedValueOnce('3');    // commandLogs months

            const auditQb = createMockQueryBuilder();
            auditQb.delete = jest.fn().mockReturnThis();
            auditQb.where = jest.fn().mockReturnThis();
            auditQb.execute = jest.fn().mockResolvedValue({ affected: 10 });
            mockAuditRepo.createQueryBuilder.mockReturnValue(auditQb);

            const visitQb = createMockQueryBuilder();
            visitQb.delete = jest.fn().mockReturnThis();
            visitQb.where = jest.fn().mockReturnThis();
            visitQb.execute = jest.fn().mockResolvedValue({ affected: 5 });
            mockVisitRepo.createQueryBuilder.mockReturnValue(visitQb);

            const cmdQb = createMockQueryBuilder();
            cmdQb.delete = jest.fn().mockReturnThis();
            cmdQb.where = jest.fn().mockReturnThis();
            cmdQb.execute = jest.fn().mockResolvedValue({ affected: 20 });
            mockCommandLogRepo.createQueryBuilder.mockReturnValue(cmdQb);

            await service.handleRetentionCleanup();

            expect(mockSettingsService.getValue).toHaveBeenCalledWith('retention.auditLogsMonths');
            expect(mockSettingsService.getValue).toHaveBeenCalledWith('retention.visitsMonths');
            expect(mockSettingsService.getValue).toHaveBeenCalledWith('retention.deviceCommandLogsMonths');
            expect(auditQb.execute).toHaveBeenCalled();
            expect(visitQb.execute).toHaveBeenCalled();
            expect(cmdQb.execute).toHaveBeenCalled();
        });

        it('should skip cleanup when settings are empty', async () => {
            mockSettingsService.getValue
                .mockResolvedValueOnce('')      // audit
                .mockResolvedValueOnce(null)    // visits
                .mockResolvedValueOnce('');     // commandLogs

            await service.handleRetentionCleanup();

            expect(mockAuditRepo.createQueryBuilder).not.toHaveBeenCalled();
            expect(mockVisitRepo.createQueryBuilder).not.toHaveBeenCalled();
            expect(mockCommandLogRepo.createQueryBuilder).not.toHaveBeenCalled();
        });

        it('should skip cleanup when settings are invalid', async () => {
            mockSettingsService.getValue
                .mockResolvedValueOnce('-1')    // audit invalid
                .mockResolvedValueOnce('abc')   // visits invalid
                .mockResolvedValueOnce('0');    // commandLogs invalid

            await service.handleRetentionCleanup();

            expect(mockAuditRepo.createQueryBuilder).not.toHaveBeenCalled();
            expect(mockVisitRepo.createQueryBuilder).not.toHaveBeenCalled();
            expect(mockCommandLogRepo.createQueryBuilder).not.toHaveBeenCalled();
        });

        it('should only clean audit logs if visits and commandLogs settings are disabled', async () => {
            mockSettingsService.getValue
                .mockResolvedValueOnce('3')      // audit
                .mockResolvedValueOnce('')       // visits disabled
                .mockResolvedValueOnce('');      // commandLogs disabled

            const auditQb = createMockQueryBuilder();
            auditQb.delete = jest.fn().mockReturnThis();
            auditQb.where = jest.fn().mockReturnThis();
            auditQb.execute = jest.fn().mockResolvedValue({ affected: 0 });
            mockAuditRepo.createQueryBuilder.mockReturnValue(auditQb);

            await service.handleRetentionCleanup();

            expect(auditQb.execute).toHaveBeenCalled();
            expect(mockVisitRepo.createQueryBuilder).not.toHaveBeenCalled();
            expect(mockCommandLogRepo.createQueryBuilder).not.toHaveBeenCalled();
        });

        it('should clean device command logs when months setting is valid', async () => {
            mockSettingsService.getValue
                .mockResolvedValueOnce('')       // audit disabled
                .mockResolvedValueOnce('')       // visits disabled
                .mockResolvedValueOnce('6');     // commandLogs 6 months

            const cmdQb = createMockQueryBuilder();
            cmdQb.delete = jest.fn().mockReturnThis();
            cmdQb.where = jest.fn().mockReturnThis();
            cmdQb.execute = jest.fn().mockResolvedValue({ affected: 15 });
            mockCommandLogRepo.createQueryBuilder.mockReturnValue(cmdQb);

            await service.handleRetentionCleanup();

            expect(mockAuditRepo.createQueryBuilder).not.toHaveBeenCalled();
            expect(mockVisitRepo.createQueryBuilder).not.toHaveBeenCalled();
            expect(cmdQb.execute).toHaveBeenCalled();
            expect(cmdQb.where).toHaveBeenCalledWith(
                expect.stringContaining('status IN'),
                expect.objectContaining({
                    statuses: ['completed', 'failed', 'timeout'],
                }),
            );
        });

        it('should skip device command logs when months setting is empty', async () => {
            mockSettingsService.getValue
                .mockResolvedValueOnce('')       // audit disabled
                .mockResolvedValueOnce('')       // visits disabled
                .mockResolvedValueOnce('');      // commandLogs empty

            await service.handleRetentionCleanup();

            expect(mockCommandLogRepo.createQueryBuilder).not.toHaveBeenCalled();
        });

        it('should not crash if cleanup throws', async () => {
            mockSettingsService.getValue
                .mockResolvedValueOnce('6')
                .mockResolvedValueOnce('12')
                .mockResolvedValueOnce('3');

            mockAuditRepo.createQueryBuilder.mockImplementation(() => {
                throw new Error('DB connection failed');
            });

            // Should not throw
            await expect(service.handleRetentionCleanup()).resolves.not.toThrow();
        });

        it('should include commandLogsDeleted in audit log', async () => {
            mockSettingsService.getValue
                .mockResolvedValueOnce('')       // audit disabled
                .mockResolvedValueOnce('')       // visits disabled
                .mockResolvedValueOnce('3');     // commandLogs months

            const cmdQb = createMockQueryBuilder();
            cmdQb.delete = jest.fn().mockReturnThis();
            cmdQb.where = jest.fn().mockReturnThis();
            cmdQb.execute = jest.fn().mockResolvedValue({ affected: 42 });
            mockCommandLogRepo.createQueryBuilder.mockReturnValue(cmdQb);

            await service.handleRetentionCleanup();

            expect(mockAuditService.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'RETENTION_CLEANUP',
                    metadata: expect.objectContaining({
                        commandLogsDeleted: 42,
                        cmdLogsMonths: 3,
                    }),
                }),
            );
        });

        it('should report all three deletion counts in audit metadata', async () => {
            mockSettingsService.getValue
                .mockResolvedValueOnce('6')     // audit months
                .mockResolvedValueOnce('12')    // visits months
                .mockResolvedValueOnce('3');    // commandLogs months

            const auditQb = createMockQueryBuilder();
            auditQb.delete = jest.fn().mockReturnThis();
            auditQb.where = jest.fn().mockReturnThis();
            auditQb.execute = jest.fn().mockResolvedValue({ affected: 100 });
            mockAuditRepo.createQueryBuilder.mockReturnValue(auditQb);

            const visitQb = createMockQueryBuilder();
            visitQb.delete = jest.fn().mockReturnThis();
            visitQb.where = jest.fn().mockReturnThis();
            visitQb.execute = jest.fn().mockResolvedValue({ affected: 50 });
            mockVisitRepo.createQueryBuilder.mockReturnValue(visitQb);

            const cmdQb = createMockQueryBuilder();
            cmdQb.delete = jest.fn().mockReturnThis();
            cmdQb.where = jest.fn().mockReturnThis();
            cmdQb.execute = jest.fn().mockResolvedValue({ affected: 25 });
            mockCommandLogRepo.createQueryBuilder.mockReturnValue(cmdQb);

            await service.handleRetentionCleanup();

            expect(mockAuditService.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: expect.objectContaining({
                        auditMonths: 6,
                        visitsMonths: 12,
                        cmdLogsMonths: 3,
                        auditDeleted: 100,
                        visitsDeleted: 50,
                        commandLogsDeleted: 25,
                    }),
                }),
            );
        });

        it('should report zero deletions when nothing matches', async () => {
            mockSettingsService.getValue
                .mockResolvedValueOnce('6')
                .mockResolvedValueOnce('12')
                .mockResolvedValueOnce('3');

            for (const repo of [mockAuditRepo, mockVisitRepo, mockCommandLogRepo]) {
                const qb = createMockQueryBuilder();
                qb.delete = jest.fn().mockReturnThis();
                qb.where = jest.fn().mockReturnThis();
                qb.execute = jest.fn().mockResolvedValue({ affected: 0 });
                repo.createQueryBuilder.mockReturnValue(qb);
            }

            await service.handleRetentionCleanup();

            expect(mockAuditService.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: expect.objectContaining({
                        auditDeleted: 0,
                        visitsDeleted: 0,
                        commandLogsDeleted: 0,
                    }),
                }),
            );
        });

        it('should fetch exactly 3 settings', async () => {
            mockSettingsService.getValue.mockResolvedValue('');

            await service.handleRetentionCleanup();

            expect(mockSettingsService.getValue).toHaveBeenCalledTimes(3);
            expect(mockSettingsService.getValue).toHaveBeenCalledWith('retention.auditLogsMonths');
            expect(mockSettingsService.getValue).toHaveBeenCalledWith('retention.visitsMonths');
            expect(mockSettingsService.getValue).toHaveBeenCalledWith('retention.deviceCommandLogsMonths');
        });
    });

    describe('deleteOldDeviceCommandLogs', () => {
        it('should delete terminal-status records in batches and return total count', async () => {
            const qb = createMockQueryBuilder();
            qb.delete = jest.fn().mockReturnThis();
            qb.where = jest.fn().mockReturnThis();
            qb.execute = jest.fn()
                .mockResolvedValueOnce({ affected: 5000 })
                .mockResolvedValueOnce({ affected: 200 });
            mockCommandLogRepo.createQueryBuilder.mockReturnValue(qb);

            const cutoff = new Date();
            const result = await service.deleteOldDeviceCommandLogs(cutoff);

            expect(result).toBe(5200);
            expect(qb.execute).toHaveBeenCalledTimes(2);
            expect(qb.where).toHaveBeenCalledWith(
                expect.stringContaining('status IN'),
                expect.objectContaining({
                    statuses: ['completed', 'failed', 'timeout'],
                    cutoff,
                }),
            );
        });

        it('should return 0 when no records to delete', async () => {
            const qb = createMockQueryBuilder();
            qb.delete = jest.fn().mockReturnThis();
            qb.where = jest.fn().mockReturnThis();
            qb.execute = jest.fn().mockResolvedValue({ affected: 0 });
            mockCommandLogRepo.createQueryBuilder.mockReturnValue(qb);

            const result = await service.deleteOldDeviceCommandLogs(new Date());
            expect(result).toBe(0);
        });
    });
});
