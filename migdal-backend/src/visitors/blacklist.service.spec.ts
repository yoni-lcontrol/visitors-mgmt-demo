import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { BlacklistService } from './blacklist.service';
import { BlacklistEntry } from './entities/blacklist.entity';
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
    let mockWsGateway: ReturnType<typeof createMockWsGateway>;
    let mockAuditService: ReturnType<typeof createMockAuditService>;

    beforeEach(async () => {
        mockRepo = createMockRepository();
        mockUserRepo = createMockRepository();
        mockWsGateway = createMockWsGateway();
        mockAuditService = createMockAuditService();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BlacklistService,
                { provide: getRepositoryToken(BlacklistEntry), useValue: mockRepo },
                { provide: getRepositoryToken(User), useValue: mockUserRepo },
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
        it('should create permanent person blacklist entry', async () => {
            mockRepo.save.mockImplementation((e: any) => Promise.resolve({ id: 'b1', ...e }));

            const result = await service.create({
                blacklistType: 'person',
                firstName: 'John', lastName: 'Doe', idNumber: '123', phoneNumber: '0501234567', reason: 'Security',
                isPermanent: true,
            } as any, 'admin-id');

            expect(mockRepo.create).toHaveBeenCalled();
            expect(mockRepo.save).toHaveBeenCalled();
        });

        it('should create vehicle blacklist entry', async () => {
            mockRepo.save.mockImplementation((e: any) => Promise.resolve({ id: 'b2', ...e }));

            const result = await service.create({
                blacklistType: 'vehicle',
                carNumber: '12-345-67', vehicleType: 'private', reason: 'Stolen vehicle',
                isPermanent: true,
            } as any, 'admin-id');

            expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                blacklistType: 'vehicle',
                carNumber: '12-345-67',
                vehicleType: 'private',
            }));
            expect(mockRepo.save).toHaveBeenCalled();
        });

        it('should create person blacklist entry without phoneNumber', async () => {
            mockRepo.save.mockImplementation((e: any) => Promise.resolve({ id: 'b3', ...e }));

            const result = await service.create({
                blacklistType: 'person',
                firstName: 'No', lastName: 'Phone', idNumber: '789', reason: 'No phone test',
                isPermanent: true,
            } as any, 'admin-id');

            expect(mockRepo.create).toHaveBeenCalled();
            expect(mockRepo.save).toHaveBeenCalled();
        });

        it('should attach notifyUsers when notifyUserIds provided', async () => {
            mockRepo.save.mockImplementation((e: any) => Promise.resolve({ id: 'b1', ...e }));

            await service.create({
                blacklistType: 'person',
                firstName: 'Jane', lastName: 'Doe', idNumber: '456', reason: 'Violation',
                isPermanent: true, notifyUserIds: ['u1', 'u2'],
            } as any);

            expect(mockRepo.create).toHaveBeenCalled();
        });

        it('should audit log on create', async () => {
            mockRepo.save.mockImplementation((e: any) => Promise.resolve({ id: 'bl-1', ...e }));
            await service.create({ blacklistType: 'person', firstName: 'Bad', lastName: 'Actor', idNumber: '999', reason: 'test', isPermanent: true } as any, 'user-1');
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
        it('should return true for permanent active entry', () => {
            const entry = { isActive: true, isPermanent: true } as BlacklistEntry;
            expect(service.isEntryActive(entry)).toBe(true);
        });

        it('should return false for inactive entry', () => {
            const entry = { isActive: false, isPermanent: true } as BlacklistEntry;
            expect(service.isEntryActive(entry)).toBe(false);
        });

        it('should return true for date-ranged entry within range', () => {
            const today = new Date();
            const start = new Date(today);
            start.setDate(start.getDate() - 1);
            const end = new Date(today);
            end.setDate(end.getDate() + 1);

            const entry = { isActive: true, isPermanent: false, startDate: start, endDate: end } as BlacklistEntry;
            expect(service.isEntryActive(entry)).toBe(true);
        });

        it('should return false for expired date-ranged entry', () => {
            const past = new Date('2020-01-01');
            const entry = { isActive: true, isPermanent: false, startDate: past, endDate: new Date('2020-12-31') } as BlacklistEntry;
            expect(service.isEntryActive(entry)).toBe(false);
        });

        it('should return false for entry with future start date', () => {
            const future = new Date();
            future.setFullYear(future.getFullYear() + 1);
            const futureEnd = new Date(future);
            futureEnd.setMonth(futureEnd.getMonth() + 1);
            const entry = { isActive: true, isPermanent: false, startDate: future, endDate: futureEnd } as BlacklistEntry;
            expect(service.isEntryActive(entry)).toBe(false);
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
                { id: 'b1', idNumber: '123', reason: 'Bad actor', isActive: true, isPermanent: true, blacklistType: 'person', notifyUsers: [] },
            ]);
            const result = await service.checkBlacklistStatus('123');
            expect(result.isBlacklisted).toBe(true);
            expect(result.reason).toBe('Bad actor');
        });

        it('should return isBlacklisted true for time-limited entry within range', async () => {
            const today = new Date();
            const start = new Date(today); start.setDate(start.getDate() - 5);
            const end = new Date(today); end.setDate(end.getDate() + 5);
            mockRepo.find.mockResolvedValue([
                { id: 'b2', idNumber: '456', reason: 'Temporary ban', isActive: true, isPermanent: false, startDate: start, endDate: end, blacklistType: 'person', notifyUsers: [] },
            ]);
            const result = await service.checkBlacklistStatus('456');
            expect(result.isBlacklisted).toBe(true);
            expect(result.reason).toBe('Temporary ban');
        });

        it('should return isBlacklisted false for expired time-limited entry', async () => {
            mockRepo.find.mockResolvedValue([
                { id: 'b3', idNumber: '789', reason: 'Old ban', isActive: true, isPermanent: false, startDate: new Date('2020-01-01'), endDate: new Date('2020-06-30'), blacklistType: 'person', notifyUsers: [] },
            ]);
            const result = await service.checkBlacklistStatus('789');
            expect(result.isBlacklisted).toBe(false);
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
                { id: 'b1', idNumber: '111', reason: 'Threat', isActive: true, isPermanent: true, blacklistType: 'person', notifyUsers: [] },
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

        it('should filter out expired entries', async () => {
            const past = new Date('2020-01-01');
            mockRepo.find.mockResolvedValue([
                { id: 'b1', idNumber: '111', reason: 'Old', isActive: true, isPermanent: false, startDate: past, endDate: new Date('2020-12-31'), blacklistType: 'person', notifyUsers: [] },
            ]);
            const result = await service.checkBlacklistStatusBatch(['111']);
            expect(result.get('111')).toEqual({ isBlacklisted: false });
        });
    });

    describe('checkVehicleBlacklistStatusBatch', () => {
        it('should return empty map for empty input', async () => {
            const result = await service.checkVehicleBlacklistStatusBatch([]);
            expect(result.size).toBe(0);
        });

        it('should return isBlacklisted true for matching vehicles', async () => {
            mockRepo.find.mockResolvedValue([
                { id: 'v1', carNumber: '12-345-67', reason: 'Stolen', isActive: true, isPermanent: true, blacklistType: 'vehicle', notifyUsers: [] },
            ]);
            const result = await service.checkVehicleBlacklistStatusBatch(['12-345-67', '99-999-99']);
            expect(result.get('12-345-67')).toEqual({ isBlacklisted: true, reason: 'Stolen' });
            expect(result.get('99-999-99')).toEqual({ isBlacklisted: false });
        });

        it('should filter out expired vehicle entries in batch', async () => {
            mockRepo.find.mockResolvedValue([
                { id: 'v2', carNumber: '11-111-11', reason: 'Old ban', isActive: true, isPermanent: false, startDate: new Date('2020-01-01'), endDate: new Date('2020-12-31'), blacklistType: 'vehicle', notifyUsers: [] },
            ]);
            const result = await service.checkVehicleBlacklistStatusBatch(['11-111-11']);
            expect(result.get('11-111-11')).toEqual({ isBlacklisted: false });
        });
    });

    describe('checkVehicleBlacklistStatus', () => {
        it('should return isBlacklisted false when no vehicle entries match', async () => {
            mockRepo.find.mockResolvedValue([]);
            const result = await service.checkVehicleBlacklistStatus('12-345-67');
            expect(result.isBlacklisted).toBe(false);
        });

        it('should return isBlacklisted true with reason for blacklisted vehicle', async () => {
            mockRepo.find.mockResolvedValue([
                { id: 'v1', carNumber: '12-345-67', reason: 'Stolen vehicle', isActive: true, isPermanent: true, blacklistType: 'vehicle', notifyUsers: [] },
            ]);
            const result = await service.checkVehicleBlacklistStatus('12-345-67');
            expect(result.isBlacklisted).toBe(true);
            expect(result.reason).toBe('Stolen vehicle');
        });

        it('should return isBlacklisted true for time-limited vehicle entry within range', async () => {
            const today = new Date();
            const start = new Date(today); start.setDate(start.getDate() - 3);
            const end = new Date(today); end.setDate(end.getDate() + 3);
            mockRepo.find.mockResolvedValue([
                { id: 'v2', carNumber: '55-555-55', reason: 'Temp vehicle ban', isActive: true, isPermanent: false, startDate: start, endDate: end, blacklistType: 'vehicle', notifyUsers: [] },
            ]);
            const result = await service.checkVehicleBlacklistStatus('55-555-55');
            expect(result.isBlacklisted).toBe(true);
            expect(result.reason).toBe('Temp vehicle ban');
        });

        it('should return isBlacklisted false for expired time-limited vehicle entry', async () => {
            mockRepo.find.mockResolvedValue([
                { id: 'v3', carNumber: '77-777-77', reason: 'Old ban', isActive: true, isPermanent: false, startDate: new Date('2020-01-01'), endDate: new Date('2020-06-30'), blacklistType: 'vehicle', notifyUsers: [] },
            ]);
            const result = await service.checkVehicleBlacklistStatus('77-777-77');
            expect(result.isBlacklisted).toBe(false);
        });
    });

    describe('findActiveByCarNumber', () => {
        it('should return active vehicle blacklist entries', async () => {
            mockRepo.find.mockResolvedValue([
                { id: 'v1', carNumber: '12-345-67', isActive: true, isPermanent: true, blacklistType: 'vehicle', notifyUsers: [] },
            ]);
            const result = await service.findActiveByCarNumber('12-345-67');
            expect(result).toHaveLength(1);
            expect(result[0].carNumber).toBe('12-345-67');
        });

        it('should filter out expired vehicle entries', async () => {
            const past = new Date('2020-01-01');
            mockRepo.find.mockResolvedValue([
                { id: 'v1', carNumber: '12-345-67', isActive: true, isPermanent: false, startDate: past, endDate: new Date('2020-12-31'), blacklistType: 'vehicle', notifyUsers: [] },
            ]);
            const result = await service.findActiveByCarNumber('12-345-67');
            expect(result).toHaveLength(0);
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
        it('should export person blacklist entries with correct columns', async () => {
            const entries = [
                {
                    id: 'b1', blacklistType: 'person', firstName: 'John', lastName: 'Doe',
                    idNumber: '123456', phoneNumber: '050-111', reason: 'Security',
                    isPermanent: true, startDate: null, endDate: null,
                    blockedAt: new Date('2025-01-15'), notes: 'Test note',
                    createdByUser: { firstName: 'Admin', lastName: 'User' },
                    notifyUsers: [{ firstName: 'Bob', lastName: 'Smith' }],
                },
            ];
            const qb = createMockQueryBuilder(entries, entries.length);
            mockRepo.createQueryBuilder.mockReturnValue(qb);

            const result = await service.exportToExcel({ page: 1, limit: 10 } as any, 'person');

            expect(toExcelBuffer).toHaveBeenCalledWith(
                expect.arrayContaining([expect.objectContaining({
                    'First Name': 'John',
                    'Last Name': 'Doe',
                    'ID Number': '123456',
                    'Phone Number': '050-111',
                    'Reason': 'Security',
                    'Duration': 'Permanent',
                    'Created By': 'Admin User',
                    'Notify Users': 'Bob Smith',
                    'Notes': 'Test note',
                })]),
                'Person Blacklist',
            );
            expect(result).toBeInstanceOf(Buffer);
        });

        it('should export vehicle blacklist entries with correct columns', async () => {
            const entries = [
                {
                    id: 'v1', blacklistType: 'vehicle', carNumber: '12-345-67', vehicleType: 'private',
                    reason: 'Stolen', isPermanent: false,
                    startDate: new Date('2025-01-01'), endDate: new Date('2025-12-31'),
                    blockedAt: new Date('2025-01-01'), notes: '',
                    firstName: null, lastName: null, idNumber: null, phoneNumber: null,
                    createdByUser: null, notifyUsers: [],
                },
            ];
            const qb = createMockQueryBuilder(entries, entries.length);
            mockRepo.createQueryBuilder.mockReturnValue(qb);

            const result = await service.exportToExcel({ page: 1, limit: 10 } as any, 'vehicle');

            expect(toExcelBuffer).toHaveBeenCalledWith(
                expect.arrayContaining([expect.objectContaining({
                    'Car Number': '12-345-67',
                    'Vehicle Type': 'private',
                    'Reason': 'Stolen',
                    'Created By': '',
                    'Notify Users': '',
                })]),
                'Vehicle Blacklist',
            );
            expect(result).toBeInstanceOf(Buffer);
        });

        it('should export empty list without error', async () => {
            const qb = createMockQueryBuilder([], 0);
            mockRepo.createQueryBuilder.mockReturnValue(qb);

            const result = await service.exportToExcel({ page: 1, limit: 10 } as any, 'person');

            expect(toExcelBuffer).toHaveBeenCalledWith([], 'Person Blacklist');
            expect(result).toBeInstanceOf(Buffer);
        });

        it('should apply same filters and sorting as findAll', async () => {
            const qb = createMockQueryBuilder([], 0);
            mockRepo.createQueryBuilder.mockReturnValue(qb);

            await service.exportToExcel({
                page: 1, limit: 10, sortBy: 'reason', sortOrder: 'ASC', search: 'test',
            } as any, 'vehicle');

            expect(qb.andWhere).toHaveBeenCalledWith('b.blacklistType = :blacklistType', { blacklistType: 'vehicle' });
            expect(qb.andWhere).toHaveBeenCalledWith(
                '(b.firstName LIKE :s OR b.lastName LIKE :s OR b.idNumber LIKE :s OR b.carNumber LIKE :s OR b.reason LIKE :s)',
                { s: '%test%' },
            );
            expect(qb.orderBy).toHaveBeenCalledWith('b.reason', 'ASC');
        });
    });
});
