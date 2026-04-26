import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BuildingsService } from './buildings.service';
import { Building } from './entities/building.entity';
import { AccessLevel } from '../access-control/entities/access-level.entity';
import { AuditService } from '../audit/audit.service';
import { createMockRepository, createMockQueryBuilder, createMockAuditService } from '../test-utils/mock.factory';

describe('BuildingsService', () => {
    let service: BuildingsService;
    let mockBuildingRepo: ReturnType<typeof createMockRepository>;
    let mockAccessLevelRepo: ReturnType<typeof createMockRepository>;
    let mockAuditService: ReturnType<typeof createMockAuditService>;

    beforeEach(async () => {
        mockBuildingRepo = createMockRepository();
        mockAccessLevelRepo = createMockRepository();
        mockAuditService = createMockAuditService();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BuildingsService,
                { provide: getRepositoryToken(Building), useValue: mockBuildingRepo },
                { provide: getRepositoryToken(AccessLevel), useValue: mockAccessLevelRepo },
                { provide: AuditService, useValue: mockAuditService },
            ],
        }).compile();

        service = module.get<BuildingsService>(BuildingsService);
    });

    describe('findAll', () => {
        it('should return paginated buildings', async () => {
            const buildings = [{ id: '1', name: 'Building A', active: true }];
            const qb = createMockQueryBuilder(buildings, 1);
            mockBuildingRepo.createQueryBuilder.mockReturnValue(qb);

            const result = await service.findAll({ page: 1, limit: 10 } as any);

            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(result.page).toBe(1);
            expect(result.totalPages).toBe(1);
        });

        it('should apply active filter', async () => {
            const qb = createMockQueryBuilder([], 0);
            mockBuildingRepo.createQueryBuilder.mockReturnValue(qb);

            await service.findAll({ page: 1, limit: 10, active: true } as any);

            expect(qb.andWhere).toHaveBeenCalledWith('b.active = :active', { active: true });
        });

        it('should apply search filter', async () => {
            const qb = createMockQueryBuilder([], 0);
            mockBuildingRepo.createQueryBuilder.mockReturnValue(qb);

            await service.findAll({ page: 1, limit: 10, search: 'main' } as any);

            expect(qb.andWhere).toHaveBeenCalledWith('(b.name LIKE :s OR b.address LIKE :s)', { s: '%main%' });
        });
    });

    describe('findById', () => {
        it('should return building when found', async () => {
            mockBuildingRepo.findOne.mockResolvedValue({ id: '1', name: 'Building A' });
            const result = await service.findById('1');
            expect(result.name).toBe('Building A');
        });

        it('should throw NotFoundException when not found', async () => {
            mockBuildingRepo.findOne.mockResolvedValue(null);
            await expect(service.findById('bad')).rejects.toThrow(NotFoundException);
        });
    });

    describe('findAccessLevels', () => {
        it('should return active access levels from AccessLevels table', async () => {
            const accessLevels = [
                { id: 'al-1', name: 'VIP', active: true, isActive: true, visitorAccess: true },
                { id: 'al-2', name: 'Standard', active: true, isActive: true, visitorAccess: true },
            ];
            mockAccessLevelRepo.find.mockResolvedValue(accessLevels);

            const result = await service.findAccessLevels();

            expect(result).toEqual(accessLevels);
            expect(mockAccessLevelRepo.find).toHaveBeenCalledWith({
                where: {
                    isActive: true,
                    active: true,
                    visitorAccess: true,
                },
                order: {
                    name: 'ASC',
                },
            });
        });
    });

    describe('create', () => {
        it('should create a building and log audit', async () => {
            mockAccessLevelRepo.find.mockResolvedValue([]);
            mockBuildingRepo.save.mockImplementation((e: any) => Promise.resolve({ id: 'new', ...e }));

            const dto = { name: 'Building B', address: '456 Oak St' };
            const result = await service.create(dto, 'user-1');

            expect(mockBuildingRepo.create).toHaveBeenCalledWith(dto);
            expect(mockBuildingRepo.save).toHaveBeenCalled();
            expect(mockAuditService.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    module: 'buildings',
                    action: 'CREATE',
                    entity: 'Building',
                }),
            );
        });

        it('should assign access levels when accessLevelIds are provided', async () => {
            const matchedAccessLevels = [{ id: 'al-1' }, { id: 'al-2' }];
            mockAccessLevelRepo.find.mockResolvedValue(matchedAccessLevels);
            mockBuildingRepo.save.mockImplementation((e: any) => Promise.resolve({ id: 'new', ...e }));

            await service.create({ name: 'Building C', accessLevelIds: ['al-1', 'al-2'] } as any, 'user-1');

            expect(mockBuildingRepo.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Building C' }));
            expect(mockBuildingRepo.save).toHaveBeenCalledWith(expect.objectContaining({ accessLevels: matchedAccessLevels }));
            expect(mockAccessLevelRepo.find).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({
                    visitorAccess: true,
                }),
            }));
        });

        it('should throw BadRequestException when some access levels are missing', async () => {
            mockAccessLevelRepo.find.mockResolvedValue([{ id: 'al-1' }]);

            await expect(
                service.create({ name: 'Building D', accessLevelIds: ['al-1', 'al-2'] } as any, 'user-1'),
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('update', () => {
        it('should update a building and log audit', async () => {
            mockBuildingRepo.findOne.mockResolvedValue({
                id: '1',
                name: 'Old',
                address: null,
                active: true,
                isActive: true,
                accessLevels: [],
            });
            mockBuildingRepo.save.mockImplementation((e: any) => Promise.resolve(e));

            await service.update('1', { name: 'Updated' }, 'user-1');

            expect(mockBuildingRepo.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Updated' }));
            expect(mockAuditService.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    module: 'buildings',
                    action: 'UPDATE',
                    entity: 'Building',
                }),
            );
        });

        it('should throw NotFoundException on missing building', async () => {
            mockBuildingRepo.findOne.mockResolvedValue(null);
            await expect(service.update('bad', { name: 'X' })).rejects.toThrow(NotFoundException);
        });

        it('should replace access levels when accessLevelIds are provided', async () => {
            mockBuildingRepo.findOne.mockResolvedValue({
                id: '1',
                name: 'Old',
                address: null,
                active: true,
                isActive: true,
                accessLevels: [{ id: 'al-1', isActive: true, active: true }],
            });
            mockAccessLevelRepo.find.mockResolvedValue([{ id: 'al-2' }]);
            mockBuildingRepo.save.mockImplementation((e: any) => Promise.resolve(e));

            await service.update('1', { accessLevelIds: ['al-2'] } as any, 'user-1');

            expect(mockBuildingRepo.save).toHaveBeenCalledWith(expect.objectContaining({
                accessLevels: [{ id: 'al-2' }],
            }));
        });
    });
});
