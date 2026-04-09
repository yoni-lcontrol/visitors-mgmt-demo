import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VisitorLogService, EntranceExitLogItem } from './visitor-log.service';
import { VisitVisitorStatus } from './entities/visit-visitor-status.entity';
import { createMockRepository, createMockQueryBuilder } from '../test-utils/mock.factory';
import { EntranceExitLogQueryDto } from './dto/entrance-exit-log-query.dto';

describe('VisitorLogService – Entrance/Exit Logs', () => {
    let service: VisitorLogService;
    let mockStatusRepo: ReturnType<typeof createMockRepository>;

    beforeEach(async () => {
        mockStatusRepo = createMockRepository();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                VisitorLogService,
                { provide: getRepositoryToken(VisitVisitorStatus), useValue: mockStatusRepo },
            ],
        }).compile();

        service = module.get<VisitorLogService>(VisitorLogService);
    });

    const sampleRaw = [
        {
            visitVisitorId: 'vv-1',
            visitorId: 'v-1',
            firstName: 'Alice',
            lastName: 'Smith',
            personId: '123456',
            phone: '+972501234567',
            email: 'alice@test.com',
            currentStatus: 2,
            arrivedAtUtc: new Date('2026-03-01T08:00:00Z'),
            checkedInAtUtc: new Date('2026-03-01T08:30:00Z'),
            checkedOutAtUtc: null,
            lastEventTimeUtc: new Date('2026-03-01T08:30:00Z'),
        },
        {
            visitVisitorId: 'vv-2',
            visitorId: 'v-2',
            firstName: 'Bob',
            lastName: 'Jones',
            personId: '654321',
            phone: null,
            email: null,
            currentStatus: 3,
            arrivedAtUtc: new Date('2026-03-01T07:00:00Z'),
            checkedInAtUtc: new Date('2026-03-01T07:30:00Z'),
            checkedOutAtUtc: new Date('2026-03-01T16:00:00Z'),
            lastEventTimeUtc: new Date('2026-03-01T16:00:00Z'),
        },
    ];

    describe('findEntranceExitLogs', () => {
        it('should return paginated entrance/exit logs', async () => {
            const qb = createMockQueryBuilder(sampleRaw, 2);
            mockStatusRepo.createQueryBuilder.mockReturnValue(qb);

            const query: EntranceExitLogQueryDto = { page: 1, limit: 20 };
            const result = await service.findEntranceExitLogs(query);

            expect(result.items).toHaveLength(2);
            expect(result.total).toBe(2);
            expect(result.page).toBe(1);
            expect(result.limit).toBe(20);
            expect(result.totalPages).toBe(1);
            expect(result.items[0].firstName).toBe('Alice');
            expect(result.items[0].currentStatus).toBe(2);
            expect(result.items[1].firstName).toBe('Bob');
            expect(result.items[1].checkedOutAtUtc).toBeTruthy();
        });

        it('should apply date range filter', async () => {
            const qb = createMockQueryBuilder(sampleRaw.slice(0, 1), 1);
            mockStatusRepo.createQueryBuilder.mockReturnValue(qb);

            const query: EntranceExitLogQueryDto = {
                page: 1,
                limit: 20,
                dateFrom: '2026-03-01',
                dateTo: '2026-03-01',
            };
            const result = await service.findEntranceExitLogs(query);

            expect(qb.andWhere).toHaveBeenCalledWith(
                's.lastEventTimeUtc >= :dateFrom',
                expect.objectContaining({ dateFrom: '2026-03-01' }),
            );
            expect(qb.andWhere).toHaveBeenCalledWith(
                's.lastEventTimeUtc <= :dateTo',
                expect.objectContaining({ dateTo: expect.any(String) }),
            );
            expect(result.items).toHaveLength(1);
        });

        it('should apply status filter', async () => {
            const qb = createMockQueryBuilder([sampleRaw[1]], 1);
            mockStatusRepo.createQueryBuilder.mockReturnValue(qb);

            const query: EntranceExitLogQueryDto = {
                page: 1,
                limit: 20,
                status: 'checked-out',
            };
            const result = await service.findEntranceExitLogs(query);

            expect(qb.andWhere).toHaveBeenCalledWith(
                's.currentStatus = :statusVal',
                { statusVal: 3 },
            );
            expect(result.items).toHaveLength(1);
        });

        it('should apply search filter', async () => {
            const qb = createMockQueryBuilder([sampleRaw[0]], 1);
            mockStatusRepo.createQueryBuilder.mockReturnValue(qb);

            const query: EntranceExitLogQueryDto = {
                page: 1,
                limit: 20,
                search: 'Alice',
            };
            const result = await service.findEntranceExitLogs(query);

            expect(qb.andWhere).toHaveBeenCalledWith(
                '(vis.firstName LIKE :s OR vis.lastName LIKE :s OR vis.personId LIKE :s OR vis.phone LIKE :s OR vis.email LIKE :s)',
                { s: '%Alice%' },
            );
            expect(result.items).toHaveLength(1);
        });

        it('should apply individual field filters', async () => {
            const qb = createMockQueryBuilder([], 0);
            mockStatusRepo.createQueryBuilder.mockReturnValue(qb);

            const query: EntranceExitLogQueryDto = {
                page: 1,
                limit: 20,
                personId: '123',
                firstName: 'Ali',
                lastName: 'Smi',
                phone: '050',
                email: 'alice',
            };
            const result = await service.findEntranceExitLogs(query);

            expect(qb.andWhere).toHaveBeenCalledWith('vis.personId LIKE :personId', { personId: '%123%' });
            expect(qb.andWhere).toHaveBeenCalledWith('vis.firstName LIKE :firstName', { firstName: '%Ali%' });
            expect(qb.andWhere).toHaveBeenCalledWith('vis.lastName LIKE :lastName', { lastName: '%Smi%' });
            expect(qb.andWhere).toHaveBeenCalledWith('vis.phone LIKE :phone', { phone: '%050%' });
            expect(qb.andWhere).toHaveBeenCalledWith('vis.email LIKE :email', { email: '%alice%' });
            expect(result.items).toHaveLength(0);
            expect(result.total).toBe(0);
        });

        it('should apply sorting', async () => {
            const qb = createMockQueryBuilder(sampleRaw, 2);
            mockStatusRepo.createQueryBuilder.mockReturnValue(qb);

            const query: EntranceExitLogQueryDto = {
                page: 1,
                limit: 20,
                sortBy: 'firstName',
                sortOrder: 'ASC',
            };
            await service.findEntranceExitLogs(query);

            expect(qb.orderBy).toHaveBeenCalledWith('vis.firstName', 'ASC');
        });

        it('should paginate correctly', async () => {
            const qb = createMockQueryBuilder([sampleRaw[1]], 2);
            mockStatusRepo.createQueryBuilder.mockReturnValue(qb);

            const query: EntranceExitLogQueryDto = { page: 2, limit: 1 };
            const result = await service.findEntranceExitLogs(query);

            expect(qb.skip).toHaveBeenCalledWith(1);
            expect(qb.take).toHaveBeenCalledWith(1);
            expect(result.page).toBe(2);
            expect(result.limit).toBe(1);
            expect(result.totalPages).toBe(2);
        });

        it('should return empty result when no matching logs', async () => {
            const qb = createMockQueryBuilder([], 0);
            mockStatusRepo.createQueryBuilder.mockReturnValue(qb);

            const query: EntranceExitLogQueryDto = { page: 1, limit: 20 };
            const result = await service.findEntranceExitLogs(query);

            expect(result.items).toHaveLength(0);
            expect(result.total).toBe(0);
            expect(result.totalPages).toBe(0);
        });

        it('should use default sort when sortBy not provided', async () => {
            const qb = createMockQueryBuilder(sampleRaw, 2);
            mockStatusRepo.createQueryBuilder.mockReturnValue(qb);

            const query: EntranceExitLogQueryDto = { page: 1, limit: 20 };
            await service.findEntranceExitLogs(query);

            expect(qb.orderBy).toHaveBeenCalledWith('s.lastEventTimeUtc', 'DESC');
        });
    });

    describe('exportEntranceExitLogs', () => {
        it('should return an Excel buffer with filtered data', async () => {
            const qb = createMockQueryBuilder(sampleRaw, 2);
            mockStatusRepo.createQueryBuilder.mockReturnValue(qb);

            const query: EntranceExitLogQueryDto = { page: 1, limit: 20 };
            const buffer = await service.exportEntranceExitLogs(query);

            expect(buffer).toBeInstanceOf(Buffer);
            expect(buffer.length).toBeGreaterThan(0);
        });

        it('should respect search filter in export', async () => {
            const qb = createMockQueryBuilder([sampleRaw[0]], 1);
            mockStatusRepo.createQueryBuilder.mockReturnValue(qb);

            const query: EntranceExitLogQueryDto = { page: 1, limit: 20, search: 'Alice' };
            const buffer = await service.exportEntranceExitLogs(query);

            expect(buffer).toBeInstanceOf(Buffer);
            expect(qb.andWhere).toHaveBeenCalledWith(
                '(vis.firstName LIKE :s OR vis.lastName LIKE :s OR vis.personId LIKE :s OR vis.phone LIKE :s OR vis.email LIKE :s)',
                { s: '%Alice%' },
            );
        });

        it('should export empty Excel when no matching data', async () => {
            const qb = createMockQueryBuilder([], 0);
            mockStatusRepo.createQueryBuilder.mockReturnValue(qb);

            const query: EntranceExitLogQueryDto = { page: 1, limit: 20 };
            const buffer = await service.exportEntranceExitLogs(query);

            expect(buffer).toBeInstanceOf(Buffer);
        });
    });
});
