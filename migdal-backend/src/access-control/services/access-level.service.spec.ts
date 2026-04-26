import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { AccessLevelService } from './access-level.service';
import { AccessLevel } from '../entities/access-level.entity';
import { AuditService } from '../../audit/audit.service';
import { createMockRepository, createMockQueryBuilder, createMockAuditService } from '../../test-utils/mock.factory';

describe('AccessLevelService', () => {
    let service: AccessLevelService;
    let mockAlRepo: ReturnType<typeof createMockRepository>;
    let mockAuditService: ReturnType<typeof createMockAuditService>;

    beforeEach(async () => {
        mockAlRepo = createMockRepository();
        mockAuditService = createMockAuditService();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AccessLevelService,
                { provide: getRepositoryToken(AccessLevel), useValue: mockAlRepo },
                { provide: AuditService, useValue: mockAuditService },
            ],
        }).compile();

        service = module.get<AccessLevelService>(AccessLevelService);
    });

    describe('findAll', () => {
        it('should return paginated access levels', async () => {
            const levels = [{ id: '1', name: 'Employee', active: true }];
            const qb = createMockQueryBuilder(levels, 1);
            mockAlRepo.createQueryBuilder.mockReturnValue(qb);

            const result = await service.findAll({ page: 1, limit: 10 } as any);

            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(result.page).toBe(1);
            expect(result.totalPages).toBe(1);
        });

        it('should apply active filter', async () => {
            const qb = createMockQueryBuilder([], 0);
            mockAlRepo.createQueryBuilder.mockReturnValue(qb);

            await service.findAll({ page: 1, limit: 10, active: true } as any);

            expect(qb.andWhere).toHaveBeenCalledWith('al.active = :active', { active: true });
        });

        it('should apply visitorAccess filter', async () => {
            const qb = createMockQueryBuilder([], 0);
            mockAlRepo.createQueryBuilder.mockReturnValue(qb);

            await service.findAll({ page: 1, limit: 10, visitorAccess: true } as any);

            expect(qb.andWhere).toHaveBeenCalledWith('al.visitorAccess = :va', { va: true });
        });

        it('should apply search filter', async () => {
            const qb = createMockQueryBuilder([], 0);
            mockAlRepo.createQueryBuilder.mockReturnValue(qb);

            await service.findAll({ page: 1, limit: 10, search: 'emp' } as any);

            expect(qb.andWhere).toHaveBeenCalledWith('(al.name LIKE :s)', { s: '%emp%' });
        });
    });

    describe('findById', () => {
        it('should return access level', async () => {
            mockAlRepo.findOne.mockResolvedValue({ id: '1', name: 'Employee' });
            const result = await service.findById('1');
            expect(result.name).toBe('Employee');
        });

        it('should throw NotFoundException', async () => {
            mockAlRepo.findOne.mockResolvedValue(null);
            await expect(service.findById('bad')).rejects.toThrow(NotFoundException);
        });
    });

    describe('create', () => {
        it('should create an access level', async () => {
            mockAlRepo.save.mockImplementation((e: any) => Promise.resolve({ id: 'new', ...e }));
            const result = await service.create({ name: 'VIP', active: true } as any);
            expect(mockAlRepo.create).toHaveBeenCalled();
            expect(mockAlRepo.save).toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('should update an access level', async () => {
            mockAlRepo.findOne.mockResolvedValue({ id: '1', name: 'Old', isActive: true });
            mockAlRepo.save.mockImplementation((e: any) => Promise.resolve(e));

            const result = await service.update('1', { name: 'Updated' } as any);
            expect(mockAlRepo.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Updated' }));
        });
    });

    describe('remove', () => {
        it('should soft-delete access level', async () => {
            mockAlRepo.findOne.mockResolvedValue({ id: '1', isActive: true });

            await service.remove('1');

            // Should soft-delete
            expect(mockAlRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
        });

        it('should throw NotFoundException on missing access level', async () => {
            mockAlRepo.findOne.mockResolvedValue(null);
            await expect(service.remove('bad')).rejects.toThrow(NotFoundException);
        });
    });

    describe('upsertByExternalId', () => {
        it('should create when no externalId provided', async () => {
            mockAlRepo.create.mockReturnValue({ name: 'Level' });
            mockAlRepo.save.mockImplementation((e: any) => Promise.resolve({ id: 'new', ...e }));

            const result = await service.upsertByExternalId({ name: 'Level' });

            expect(result.action).toBe('created');
            expect(mockAlRepo.create).toHaveBeenCalled();
        });

        it('should create when externalId not found in DB', async () => {
            mockAlRepo.findOne.mockResolvedValue(null);
            mockAlRepo.create.mockReturnValue({ name: 'Level', externalId: 'ext-1' });
            mockAlRepo.save.mockImplementation((e: any) => Promise.resolve({ id: 'new', ...e }));

            const result = await service.upsertByExternalId({ name: 'Level', externalId: 'ext-1' });

            expect(result.action).toBe('created');
            expect(mockAlRepo.findOne).toHaveBeenCalledWith({ where: { externalId: 'ext-1' } });
        });

        it('should update when externalId exists and record is active', async () => {
            const existing = { id: '1', name: 'Old', externalId: 'ext-1', isActive: true };
            mockAlRepo.findOne.mockResolvedValue(existing);
            mockAlRepo.save.mockImplementation((e: any) => Promise.resolve(e));

            const result = await service.upsertByExternalId({ name: 'New', externalId: 'ext-1' });

            expect(result.action).toBe('updated');
            expect(result.entity.name).toBe('New');
        });

        it('should re-activate soft-deleted record and return created', async () => {
            const existing = { id: '1', name: 'Deleted', externalId: 'ext-1', isActive: false };
            mockAlRepo.findOne.mockResolvedValue(existing);
            mockAlRepo.save.mockImplementation((e: any) => Promise.resolve(e));

            const result = await service.upsertByExternalId({ name: 'Re-added', externalId: 'ext-1' });

            expect(result.action).toBe('created');
            expect(result.entity.isActive).toBe(true);
            expect(result.entity.name).toBe('Re-added');
        });

        it('should not overwrite existing record id when data contains id', async () => {
            const existing = { id: 'original-uuid', name: 'Old', externalId: 'ext-1', isActive: true };
            mockAlRepo.findOne.mockResolvedValue(existing);
            mockAlRepo.save.mockImplementation((e: any) => Promise.resolve(e));

            const result = await service.upsertByExternalId({ id: 'foreign-id', name: 'Updated', externalId: 'ext-1' } as any);

            expect(result.entity.id).toBe('original-uuid');
            expect(result.entity.name).toBe('Updated');
        });

        it('should not pass id to create when data contains id', async () => {
            mockAlRepo.create.mockReturnValue({ name: 'Level', externalId: 'ext-1' });
            mockAlRepo.findOne.mockResolvedValue(null);
            mockAlRepo.save.mockImplementation((e: any) => Promise.resolve({ id: 'auto-uuid', ...e }));

            await service.upsertByExternalId({ id: 'foreign-id', name: 'Level', externalId: 'ext-1' } as any);

            expect(mockAlRepo.create).toHaveBeenCalledWith(
                expect.not.objectContaining({ id: 'foreign-id' }),
            );
        });
    });
});
