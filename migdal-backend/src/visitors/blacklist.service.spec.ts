import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { BlacklistService } from './blacklist.service';
import { BlacklistEntry } from './entities/blacklist.entity';
import { VisitVisitor } from './entities/visit-visitor.entity';
import { BlacklistOverrideRequest } from './entities/blacklist-override-request.entity';
import { User } from '../users/entities/user.entity';
import { createMockRepository, createMockQueryBuilder, createMockWsGateway, createMockAuditService } from '../test-utils/mock.factory';
import { UsersGateway } from '../websocket/gateways/users.gateway';
import { AuditService } from '../audit/audit.service';

jest.mock('../common/utils/excel.util', () => ({
    toExcelBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-excel')),
}));
import { toExcelBuffer } from '../common/utils/excel.util';

describe('BlacklistService', () => {
    let service: BlacklistService;
    let mockRepo: ReturnType<typeof createMockRepository>;
    let mockUserRepo: ReturnType<typeof createMockRepository>;
    let mockVisitVisitorRepo: ReturnType<typeof createMockRepository>;
    let mockOverrideRepo: ReturnType<typeof createMockRepository>;
    let mockWsGateway: ReturnType<typeof createMockWsGateway>;
    let mockAuditService: ReturnType<typeof createMockAuditService>;

    beforeEach(async () => {
        mockRepo = createMockRepository();
        mockUserRepo = createMockRepository();
        mockVisitVisitorRepo = createMockRepository();
        mockOverrideRepo = createMockRepository();
        mockWsGateway = createMockWsGateway();
        mockAuditService = createMockAuditService();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BlacklistService,
                { provide: getRepositoryToken(BlacklistEntry), useValue: mockRepo },
                { provide: getRepositoryToken(User), useValue: mockUserRepo },
                { provide: getRepositoryToken(VisitVisitor), useValue: mockVisitVisitorRepo },
                { provide: getRepositoryToken(BlacklistOverrideRequest), useValue: mockOverrideRepo },
                { provide: UsersGateway, useValue: mockWsGateway },
                { provide: AuditService, useValue: mockAuditService },
            ],
        }).compile();

        service = module.get<BlacklistService>(BlacklistService);
    });

    describe('findAll', () => {
        it('should return paginated blacklist entries', async () => {
            const qb = createMockQueryBuilder([{ id: '1', firstName: 'John', lastName: 'Doe', isActive: true }], 1);
            mockRepo.createQueryBuilder.mockReturnValue(qb);

            const result = await service.findAll({ page: 1, limit: 10 } as any);
            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
        });

        it('should join createdByUser in query', async () => {
            const qb = createMockQueryBuilder([], 0);
            mockRepo.createQueryBuilder.mockReturnValue(qb);

            await service.findAll({ page: 1, limit: 10 } as any);
            expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('b.createdByUser', 'creator');
        });
    });

    describe('findById', () => {
        it('should return entry with notifyUsers', async () => {
            mockRepo.findOne.mockResolvedValue({
                id: '1', firstName: 'John', isActive: true, notifyUsers: [],
            });
            const result = await service.findById('1');
            expect(result.firstName).toBe('John');
        });

        it('should throw NotFoundException for missing entry', async () => {
            mockRepo.findOne.mockResolvedValue(null);
            await expect(service.findById('bad')).rejects.toThrow(NotFoundException);
        });
    });

    describe('create', () => {
        it('should create person blacklist entry', async () => {
            mockRepo.save.mockImplementation((e: any) => Promise.resolve({ id: 'b1', ...e }));

            const result = await service.create({
                firstName: 'John', lastName: 'Doe', idNumber: '123', phoneNumber: '0501234567', reason: 'Security',
            } as any, 'admin-id');

            expect(mockRepo.create).toHaveBeenCalled();
            expect(mockRepo.save).toHaveBeenCalled();
        });

        it('should create person blacklist entry without phoneNumber', async () => {
            mockRepo.save.mockImplementation((e: any) => Promise.resolve({ id: 'b3', ...e }));

            const result = await service.create({
                firstName: 'No', lastName: 'Phone', idNumber: '789', reason: 'No phone test',
            } as any, 'admin-id');

            expect(mockRepo.create).toHaveBeenCalled();
            expect(mockRepo.save).toHaveBeenCalled();
        });

        it('should attach notifyUsers when notifyUserIds provided', async () => {
            mockRepo.save.mockImplementation((e: any) => Promise.resolve({ id: 'b1', ...e }));

            await service.create({
                firstName: 'Jane', lastName: 'Doe', idNumber: '456', reason: 'Violation',
                notifyUserIds: ['u1', 'u2'],
            } as any);

            expect(mockRepo.create).toHaveBeenCalled();
        });

        it('should audit log on create', async () => {
            mockRepo.save.mockImplementation((e: any) => Promise.resolve({ id: 'bl-1', ...e }));
            await service.create({ firstName: 'Bad', lastName: 'Actor', idNumber: '999', reason: 'test' } as any, 'user-1');
            expect(mockAuditService.log).toHaveBeenCalledWith(expect.objectContaining({
                module: 'visitors', action: 'CREATE', entity: 'BlacklistEntry',
            }));
        });
    });

    describe('update', () => {
        it('should update blacklist entry', async () => {
            const entry = { id: '1', firstName: 'John', isActive: true, notifyUsers: [] };
            mockRepo.findOne.mockResolvedValue(entry);
            mockRepo.save.mockImplementation((e: any) => Promise.resolve(e));

            await service.update('1', { reason: 'Updated reason' } as any, 'admin-id');
            expect(mockRepo.save).toHaveBeenCalled();
        });
    });

    describe('remove', () => {
        it('should soft-delete blacklist entry', async () => {
            const entry = { id: '1', isActive: true, notifyUsers: [] };
            mockRepo.findOne.mockResolvedValue(entry);

            await service.remove('1', 'admin-id');
            expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
        });

        it('should audit log on delete', async () => {
            mockRepo.findOne.mockResolvedValue({ id: 'bl-1', firstName: 'Bad', lastName: 'Actor', isActive: true, notifyUsers: [] });
            mockRepo.save.mockResolvedValue({});
            await service.remove('bl-1', 'user-1');
            expect(mockAuditService.log).toHaveBeenCalledWith(expect.objectContaining({
                module: 'visitors', action: 'DELETE', entity: 'BlacklistEntry', entityId: 'bl-1',
            }));
        });
    });

    describe('isEntryActive', () => {
        it('should return true for active entry', () => {
            const entry = { isActive: true } as BlacklistEntry;
            expect(service.isEntryActive(entry)).toBe(true);
        });

        it('should return false for inactive entry', () => {
            const entry = { isActive: false } as BlacklistEntry;
            expect(service.isEntryActive(entry)).toBe(false);
        });

        it('should return false when blockedUntil is in the past', () => {
            const entry = { isActive: true, blockedUntil: new Date('2020-01-01') } as BlacklistEntry;
            expect(service.isEntryActive(entry)).toBe(false);
        });

        it('should return true when blockedUntil is in the future', () => {
            const entry = { isActive: true, blockedUntil: new Date('2099-01-01') } as BlacklistEntry;
            expect(service.isEntryActive(entry)).toBe(true);
        });

        it('should return true when blockedUntil is null (permanent)', () => {
            const entry = { isActive: true, blockedUntil: null } as BlacklistEntry;
            expect(service.isEntryActive(entry)).toBe(true);
        });
    });

    describe('checkBlacklistStatus', () => {
        it('should return isBlacklisted false when no entries match', async () => {
            mockRepo.find.mockResolvedValue([]);
            const result = await service.checkBlacklistStatus('123');
            expect(result.isBlacklisted).toBe(false);
        });

        it('should return isBlacklisted true with reason', async () => {
            mockRepo.find.mockResolvedValue([
                { id: 'b1', idNumber: '123', reason: 'Bad actor', isActive: true, notifyUsers: [], blockedUntil: null },
            ]);
            const result = await service.checkBlacklistStatus('123');
            expect(result.isBlacklisted).toBe(true);
            expect(result.reason).toBe('Bad actor');
        });

        it('should return isBlacklisted false when blockedUntil has passed', async () => {
            mockRepo.find.mockResolvedValue([
                { id: 'b1', idNumber: '123', reason: 'Expired', isActive: true, notifyUsers: [], blockedUntil: new Date('2020-01-01') },
            ]);
            const result = await service.checkBlacklistStatus('123');
            expect(result.isBlacklisted).toBe(false);
        });

        it('should return isBlacklisted true when blockedUntil is in the future', async () => {
            mockRepo.find.mockResolvedValue([
                { id: 'b1', idNumber: '123', reason: 'Temporary', isActive: true, notifyUsers: [], blockedUntil: new Date('2099-12-31') },
            ]);
            const result = await service.checkBlacklistStatus('123');
            expect(result.isBlacklisted).toBe(true);
            expect(result.blockedUntil).toEqual(new Date('2099-12-31'));
        });
    });

    describe('checkBlacklistStatusBatch', () => {
        it('should return empty map for empty input', async () => {
            const result = await service.checkBlacklistStatusBatch([]);
            expect(result.size).toBe(0);
        });

        it('should return isBlacklisted false for all when no matches', async () => {
            mockRepo.find.mockResolvedValue([]);
            const result = await service.checkBlacklistStatusBatch(['111', '222']);
            expect(result.get('111')).toEqual({ isBlacklisted: false });
            expect(result.get('222')).toEqual({ isBlacklisted: false });
        });

        it('should return isBlacklisted true for matching entries', async () => {
            mockRepo.find.mockResolvedValue([
                { id: 'b1', idNumber: '111', reason: 'Threat', isActive: true, notifyUsers: [], blockedUntil: null },
            ]);
            const result = await service.checkBlacklistStatusBatch(['111', '222']);
            expect(result.get('111')).toEqual({ isBlacklisted: true, reason: 'Threat' });
            expect(result.get('222')).toEqual({ isBlacklisted: false });
        });

        it('should deduplicate input IDs', async () => {
            mockRepo.find.mockResolvedValue([]);
            await service.checkBlacklistStatusBatch(['111', '111', '222']);
            // Should call find with unique IDs only
            expect(mockRepo.find).toHaveBeenCalledTimes(1);
        });
    });

    describe('notifyBlacklistArrival', () => {
        it('should broadcast to each notify user', () => {
            const entry = {
                id: 'b1', reason: 'Security', notifyUsers: [{ id: 'u1' }, { id: 'u2' }],
            } as any;

            service.notifyBlacklistArrival(entry, 'John Doe');

            expect(mockWsGateway.broadcastToRoom).toHaveBeenCalledTimes(2);
            expect(mockWsGateway.broadcastToRoom).toHaveBeenCalledWith('user:u1', 'blacklist:arrival', expect.any(Object));
            expect(mockWsGateway.broadcastToRoom).toHaveBeenCalledWith('user:u2', 'blacklist:arrival', expect.any(Object));
        });

        it('should not broadcast when no notifyUsers', () => {
            service.notifyBlacklistArrival({ notifyUsers: [] } as any, 'John');
            expect(mockWsGateway.broadcastToRoom).not.toHaveBeenCalled();
        });
    });

    describe('exportToExcel', () => {
        it('should export blacklist entries with correct columns', async () => {
            const entries = [
                {
                    id: 'b1', firstName: 'John', lastName: 'Doe',
                    idNumber: '123456', phoneNumber: '050-111', reason: 'Security',
                    blockedAt: new Date('2025-01-15'), notes: 'Test note',
                    createdByUser: { firstName: 'Admin', lastName: 'User' },
                    notifyUsers: [{ firstName: 'Bob', lastName: 'Smith' }],
                },
            ];
            const qb = createMockQueryBuilder(entries, entries.length);
            mockRepo.createQueryBuilder.mockReturnValue(qb);

            const result = await service.exportToExcel({ page: 1, limit: 10 } as any);

            expect(toExcelBuffer).toHaveBeenCalledWith(
                expect.arrayContaining([expect.objectContaining({
                    'First Name': 'John',
                    'Last Name': 'Doe',
                    'ID Number': '123456',
                    'Phone Number': '050-111',
                    'Reason': 'Security',
                    'Created By': 'Admin User',
                    'Notify Users': 'Bob Smith',
                    'Notes': 'Test note',
                })]),
                'Blacklist',
            );
            expect(result).toBeInstanceOf(Buffer);
        });

        it('should export empty list without error', async () => {
            const qb = createMockQueryBuilder([], 0);
            mockRepo.createQueryBuilder.mockReturnValue(qb);

            const result = await service.exportToExcel({ page: 1, limit: 10 } as any);

            expect(toExcelBuffer).toHaveBeenCalledWith([], 'Blacklist');
            expect(result).toBeInstanceOf(Buffer);
        });

        it('should apply filters and sorting', async () => {
            const qb = createMockQueryBuilder([], 0);
            mockRepo.createQueryBuilder.mockReturnValue(qb);

            await service.exportToExcel({
                page: 1, limit: 10, sortBy: 'reason', sortOrder: 'ASC', search: 'test',
            } as any);

            expect(qb.andWhere).toHaveBeenCalledWith(
                '(b.firstName LIKE :s OR b.lastName LIKE :s OR b.idNumber LIKE :s OR b.reason LIKE :s)',
                { s: '%test%' },
            );
            expect(qb.orderBy).toHaveBeenCalledWith('b.reason', 'ASC');
        });
    });

    describe('findAllRemoved', () => {
        it('should return paginated removed blacklist entries', async () => {
            const qb = createMockQueryBuilder([{ id: '1', firstName: 'John', lastName: 'Doe', isActive: false }], 1);
            mockRepo.createQueryBuilder.mockReturnValue(qb);

            const result = await service.findAllRemoved({ page: 1, limit: 10 } as any);
            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(qb.where).toHaveBeenCalledWith('b.isActive = :active', { active: false });
        });
    });

    describe('restore', () => {
        it('should reactivate a removed blacklist entry', async () => {
            const entry = { id: 'bl-1', firstName: 'John', lastName: 'Doe', isActive: false, notifyUsers: [] };
            mockRepo.findOne.mockResolvedValue(entry);
            mockRepo.save.mockImplementation((e: any) => Promise.resolve(e));

            const result = await service.restore('bl-1', 'admin-id');

            expect(result.isActive).toBe(true);
            expect(result.updatedBy).toBe('admin-id');
            expect(result.blockedAt).toBeInstanceOf(Date);
        });

        it('should return entry as-is if already active', async () => {
            const entry = { id: 'bl-1', firstName: 'John', lastName: 'Doe', isActive: true, notifyUsers: [] };
            mockRepo.findOne.mockResolvedValue(entry);

            const result = await service.restore('bl-1', 'admin-id');

            expect(result.isActive).toBe(true);
            expect(mockRepo.save).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException for missing entry', async () => {
            mockRepo.findOne.mockResolvedValue(null);
            await expect(service.restore('bad-id', 'admin-id')).rejects.toThrow(NotFoundException);
        });

        it('should audit log on restore', async () => {
            const entry = { id: 'bl-1', firstName: 'Bad', lastName: 'Actor', isActive: false, notifyUsers: [] };
            mockRepo.findOne.mockResolvedValue(entry);
            mockRepo.save.mockImplementation((e: any) => Promise.resolve(e));

            await service.restore('bl-1', 'user-1');

            expect(mockAuditService.log).toHaveBeenCalledWith(expect.objectContaining({
                module: 'visitors', action: 'RESTORE', entity: 'BlacklistEntry', entityId: 'bl-1',
            }));
        });
    });

    describe('removeExpired', () => {
        it('should deactivate expired blacklist entries', async () => {
            const qb = createMockQueryBuilder([], 0);
            qb.execute = jest.fn().mockResolvedValue({ affected: 3 });
            mockRepo.createQueryBuilder.mockReturnValue(qb);

            const count = await service.removeExpired();

            expect(count).toBe(3);
            expect(qb.update).toHaveBeenCalled();
            expect(qb.where).toHaveBeenCalledWith('isActive = :active', { active: true });
            expect(qb.andWhere).toHaveBeenCalledWith('blockedUntil IS NOT NULL');
        });

        it('should return 0 when no expired entries exist', async () => {
            const qb = createMockQueryBuilder([], 0);
            qb.execute = jest.fn().mockResolvedValue({ affected: 0 });
            mockRepo.createQueryBuilder.mockReturnValue(qb);

            const count = await service.removeExpired();
            expect(count).toBe(0);
        });
    });
});
