import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { AuditService, CreateAuditLogParams } from './audit.service';
import { AuditLog } from '../common/entities/audit-log.entity';
import { SyslogService } from './syslog.service';
import { createMockRepository, createMockQueryBuilder } from '../test-utils/mock.factory';

describe('AuditService', () => {
    let service: AuditService;
    let mockRepo: ReturnType<typeof createMockRepository>;
    let mockSyslogService: { send: jest.Mock; isEnabled: jest.Mock };

    beforeEach(async () => {
        mockRepo = createMockRepository();
        mockSyslogService = { send: jest.fn().mockResolvedValue(true), isEnabled: jest.fn().mockReturnValue(false) };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuditService,
                { provide: getRepositoryToken(AuditLog), useValue: mockRepo },
                { provide: SyslogService, useValue: mockSyslogService },
            ],
        }).compile();

        service = module.get<AuditService>(AuditService);
    });

    describe('log', () => {
        it('should create and save an audit log entry', async () => {
            const params: CreateAuditLogParams = {
                userId: 'user-1',
                module: 'users',
                action: 'CREATE',
                entity: 'User',
                entityId: 'entity-1',
                description: 'Created user test',
                performedByEmail: 'test@example.com',
                oldValue: null,
                newValue: { name: 'Test' },
                ipAddress: '127.0.0.1',
                userAgent: 'Jest',
                metadata: { source: 'api' },
            };

            await service.log(params);

            expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                userId: 'user-1',
                module: 'users',
                action: 'CREATE',
                entity: 'User',
                entityId: 'entity-1',
                description: 'Created user test',
                performedByEmail: 'test@example.com',
                newValue: JSON.stringify({ name: 'Test' }),
                metadata: JSON.stringify({ source: 'api' }),
            }));
            expect(mockRepo.save).toHaveBeenCalled();
        });

        it('should handle null optional fields', async () => {
            const params: CreateAuditLogParams = {
                action: 'DELETE',
                entity: 'Role',
            };

            await service.log(params);

            expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                userId: null,
                module: null,
                entityId: null,
                description: null,
                performedByEmail: null,
                oldValue: null,
                newValue: null,
                ipAddress: null,
                userAgent: null,
                metadata: null,
            }));
        });

        it('should JSON-stringify oldValue and newValue', async () => {
            await service.log({
                action: 'UPDATE',
                entity: 'User',
                oldValue: { name: 'Old' },
                newValue: { name: 'New' },
            });

            expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                oldValue: JSON.stringify({ name: 'Old' }),
                newValue: JSON.stringify({ name: 'New' }),
            }));
        });

        it('should JSON-stringify metadata when provided', async () => {
            await service.log({
                action: 'LOGIN',
                entity: 'User',
                metadata: { browser: 'Chrome' },
            });

            expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                metadata: JSON.stringify({ browser: 'Chrome' }),
            }));
        });
    });

    describe('findAll', () => {
        it('should return paginated audit logs', async () => {
            const items = [{ id: '1', action: 'CREATE', entity: 'User' }];
            const qb = createMockQueryBuilder(items, 1);
            mockRepo.createQueryBuilder.mockReturnValue(qb);

            const result = await service.findAll({ page: 1, limit: 10 });

            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(result.page).toBe(1);
            expect(result.totalPages).toBe(1);
            expect(qb.leftJoinAndSelect).toHaveBeenCalled();
        });

        it('should apply module filter', async () => {
            const qb = createMockQueryBuilder([], 0);
            mockRepo.createQueryBuilder.mockReturnValue(qb);

            await service.findAll({ page: 1, limit: 10, module: 'auth' });

            expect(qb.andWhere).toHaveBeenCalledWith('al.module = :module', { module: 'auth' });
        });

        it('should apply entity filter', async () => {
            const qb = createMockQueryBuilder([], 0);
            mockRepo.createQueryBuilder.mockReturnValue(qb);

            await service.findAll({ page: 1, limit: 10, entity: 'User' });

            expect(qb.andWhere).toHaveBeenCalledWith('al.entity = :entity', { entity: 'User' });
        });

        it('should apply action filter', async () => {
            const qb = createMockQueryBuilder([], 0);
            mockRepo.createQueryBuilder.mockReturnValue(qb);

            await service.findAll({ page: 1, limit: 10, action: 'CREATE' });

            expect(qb.andWhere).toHaveBeenCalledWith('al.action = :action', { action: 'CREATE' });
        });

        it('should apply userId filter', async () => {
            const qb = createMockQueryBuilder([], 0);
            mockRepo.createQueryBuilder.mockReturnValue(qb);

            await service.findAll({ page: 1, limit: 10, userId: 'user-1' });

            expect(qb.andWhere).toHaveBeenCalledWith('al.userId = :userId', { userId: 'user-1' });
        });

        it('should apply dateFrom filter with full ISO timestamp', async () => {
            const qb = createMockQueryBuilder([], 0);
            mockRepo.createQueryBuilder.mockReturnValue(qb);

            await service.findAll({ page: 1, limit: 10, dateFrom: '2024-01-01T00:00:00Z' });

            expect(qb.andWhere).toHaveBeenCalledWith('al.createdAt >= :dateFrom', { dateFrom: '2024-01-01T00:00:00Z' });
        });

        it('should apply dateTo filter with full ISO timestamp', async () => {
            const qb = createMockQueryBuilder([], 0);
            mockRepo.createQueryBuilder.mockReturnValue(qb);

            await service.findAll({ page: 1, limit: 10, dateTo: '2024-12-31T23:59:59Z' });

            expect(qb.andWhere).toHaveBeenCalledWith('al.createdAt <= :dateTo', { dateTo: '2024-12-31T23:59:59Z' });
        });

        it('should convert date-only dateFrom to start-of-day in Asia/Jerusalem timezone', async () => {
            const qb = createMockQueryBuilder([], 0);
            mockRepo.createQueryBuilder.mockReturnValue(qb);

            // Jan 15 2024 is IST (UTC+2), so start-of-day = 2024-01-14T22:00:00.000Z
            await service.findAll({ page: 1, limit: 10, dateFrom: '2024-01-15' });

            expect(qb.andWhere).toHaveBeenCalledWith(
                'al.createdAt >= :dateFrom',
                expect.objectContaining({ dateFrom: expect.stringContaining('2024-01-1') }),
            );
            // Verify it's an ISO timestamp, not a bare date
            const call = qb.andWhere.mock.calls.find((c: any[]) => c[1]?.dateFrom);
            expect(call[1].dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });

        it('should convert date-only dateTo to end-of-day in Asia/Jerusalem timezone', async () => {
            const qb = createMockQueryBuilder([], 0);
            mockRepo.createQueryBuilder.mockReturnValue(qb);

            await service.findAll({ page: 1, limit: 10, dateTo: '2024-07-15' });

            expect(qb.andWhere).toHaveBeenCalledWith(
                'al.createdAt <= :dateTo',
                expect.objectContaining({ dateTo: expect.stringContaining('2024-07-1') }),
            );
            // Verify it's an ISO timestamp with end-of-day
            const call = qb.andWhere.mock.calls.find((c: any[]) => c[1]?.dateTo);
            expect(call[1].dateTo).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });

        it('should apply search filter across multiple fields', async () => {
            const qb = createMockQueryBuilder([], 0);
            mockRepo.createQueryBuilder.mockReturnValue(qb);

            await service.findAll({ page: 1, limit: 10, search: 'user' });

            expect(qb.andWhere).toHaveBeenCalledWith(
                '(al.entity LIKE :s OR al.action LIKE :s OR al.description LIKE :s OR al.module LIKE :s)',
                { s: '%user%' },
            );
        });

        it('should use allowed sort field when provided', async () => {
            const qb = createMockQueryBuilder([], 0);
            mockRepo.createQueryBuilder.mockReturnValue(qb);

            await service.findAll({ page: 1, limit: 10, sortBy: 'module', sortOrder: 'ASC' });

            expect(qb.orderBy).toHaveBeenCalledWith('al.module', 'ASC');
        });

        it('should fallback to createdAt DESC for unknown sort field', async () => {
            const qb = createMockQueryBuilder([], 0);
            mockRepo.createQueryBuilder.mockReturnValue(qb);

            await service.findAll({ page: 1, limit: 10, sortBy: 'malicious' });

            expect(qb.orderBy).toHaveBeenCalledWith('al.createdAt', 'DESC');
        });

        it('should default to createdAt DESC when no sort specified', async () => {
            const qb = createMockQueryBuilder([], 0);
            mockRepo.createQueryBuilder.mockReturnValue(qb);

            await service.findAll({ page: 1, limit: 10 });

            expect(qb.orderBy).toHaveBeenCalledWith('al.createdAt', 'DESC');
        });

        it('should calculate totalPages correctly', async () => {
            const qb = createMockQueryBuilder([{}, {}], 15);
            mockRepo.createQueryBuilder.mockReturnValue(qb);

            const result = await service.findAll({ page: 1, limit: 10 });

            expect(result.totalPages).toBe(2);
        });
    });

    describe('findOne', () => {
        it('should return a single audit log entry', async () => {
            const log = { id: 'log-1', action: 'CREATE', entity: 'User' };
            mockRepo.findOne.mockResolvedValue(log);

            const result = await service.findOne('log-1');

            expect(result).toEqual(log);
            expect(mockRepo.findOne).toHaveBeenCalledWith({
                where: { id: 'log-1' },
                relations: ['user'],
            });
        });

        it('should throw NotFoundException when entry not found', async () => {
            mockRepo.findOne.mockResolvedValue(null);

            await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
        });
    });

    describe('exportToExcel', () => {
        it('should return an Excel buffer with mapped rows', async () => {
            const items = [
                {
                    id: 'log-1',
                    createdAt: new Date('2024-06-15T10:30:00Z'),
                    user: { firstName: 'John', lastName: 'Doe' },
                    performedByEmail: 'john@test.com',
                    module: 'users',
                    action: 'CREATE',
                    entity: 'User',
                    entityId: 'u-1',
                    description: 'Created user',
                    ipAddress: '127.0.0.1',
                },
            ];
            const qb = createMockQueryBuilder(items, 1);
            mockRepo.createQueryBuilder.mockReturnValue(qb);

            const result = await service.exportToExcel({ page: 1, limit: 25, module: 'users' });

            expect(result).toBeInstanceOf(Buffer);
            expect(qb.andWhere).toHaveBeenCalledWith('al.module = :module', { module: 'users' });
            // Should NOT paginate — getMany without skip/take
            expect(qb.skip).not.toHaveBeenCalled();
            expect(qb.take).not.toHaveBeenCalled();
        });

        it('should handle system entries without user', async () => {
            const items = [
                {
                    id: 'log-2',
                    createdAt: new Date('2024-06-15T12:00:00Z'),
                    user: null,
                    performedByEmail: null,
                    module: null,
                    action: 'RETENTION_CLEANUP',
                    entity: 'AuditLog',
                    entityId: null,
                    description: null,
                    ipAddress: null,
                },
            ];
            const qb = createMockQueryBuilder(items, 1);
            mockRepo.createQueryBuilder.mockReturnValue(qb);

            const result = await service.exportToExcel({ page: 1, limit: 25 });

            expect(result).toBeInstanceOf(Buffer);
        });
    });
});
