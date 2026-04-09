import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { RolesService } from './roles.service';
import { Role } from './entities/role.entity';
import { Permission } from '../permissions/entities/permission.entity';
import { createMockRepository, createMockQueryBuilder } from '../test-utils/mock.factory';
import { AuditService } from '../audit/audit.service';

describe('RolesService', () => {
    let service: RolesService;
    let mockRoleRepo: ReturnType<typeof createMockRepository>;
    let mockPermRepo: ReturnType<typeof createMockRepository>;
    let mockAuditService: any;

    beforeEach(async () => {
        mockRoleRepo = createMockRepository();
        mockPermRepo = createMockRepository();
        mockAuditService = {
            log: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RolesService,
                { provide: getRepositoryToken(Role), useValue: mockRoleRepo },
                { provide: getRepositoryToken(Permission), useValue: mockPermRepo },
                { provide: AuditService, useValue: mockAuditService },
            ],
        }).compile();

        service = module.get<RolesService>(RolesService);
    });

    describe('findAll', () => {
        it('should return paginated roles', async () => {
            const qb = createMockQueryBuilder([{ id: '1', name: 'Admin', permissions: [] }], 1);
            mockRoleRepo.createQueryBuilder.mockReturnValue(qb);

            const result = await service.findAll({ page: 1, limit: 10 } as any);
            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
        });
    });

    describe('findById', () => {
        it('should return role with permissions', async () => {
            mockRoleRepo.findOne.mockResolvedValue({ id: '1', name: 'Admin', permissions: [{ key: 'users.read' }] });
            const result = await service.findById('1');
            expect(result.name).toBe('Admin');
        });

        it('should throw NotFoundException for missing role', async () => {
            mockRoleRepo.findOne.mockResolvedValue(null);
            await expect(service.findById('bad-id')).rejects.toThrow(NotFoundException);
        });
    });

    describe('create', () => {
        it('should throw ConflictException for duplicate name', async () => {
            mockRoleRepo.findOne.mockResolvedValue({ id: '1', name: 'Admin' });
            await expect(service.create({ name: 'Admin' } as any)).rejects.toThrow(ConflictException);
        });

        it('should create role with permissions', async () => {
            mockRoleRepo.findOne
                .mockResolvedValueOnce(null) // no dup
                .mockResolvedValueOnce({ id: 'r1', name: 'NewRole', isActive: true, permissions: [{ key: 'users.read' }] }); // findById
            mockRoleRepo.save.mockResolvedValue({ id: 'r1' });
            mockPermRepo.findBy.mockResolvedValue([{ id: 'p1', key: 'users.read' }]);

            const result = await service.create({ name: 'NewRole', permissionIds: ['p1'] } as any);
            expect(result.name).toBe('NewRole');
        });
    });

    describe('update', () => {
        it('should throw BadRequestException when renaming system role', async () => {
            mockRoleRepo.findOne.mockResolvedValue({ id: '1', name: 'Admin', isSystem: true, isActive: true, permissions: [] });
            await expect(service.update('1', { name: 'Renamed' } as any)).rejects.toThrow(BadRequestException);
        });

        it('should throw ConflictException for duplicate name', async () => {
            mockRoleRepo.findOne
                .mockResolvedValueOnce({ id: '1', name: 'Role1', isSystem: false, isActive: true, permissions: [] })
                .mockResolvedValueOnce({ id: '2', name: 'Role2' }); // dup
            await expect(service.update('1', { name: 'Role2' } as any)).rejects.toThrow(ConflictException);
        });

        it('should update role successfully', async () => {
            const role = { id: '1', name: 'Role1', isSystem: false, isActive: true, permissions: [] };
            mockRoleRepo.findOne.mockResolvedValue(role);
            mockRoleRepo.save.mockResolvedValue(role);

            const result = await service.update('1', { description: 'Updated' } as any);
            expect(mockRoleRepo.save).toHaveBeenCalled();
        });
    });

    describe('remove', () => {
        it('should throw BadRequestException for system role', async () => {
            mockRoleRepo.findOne.mockResolvedValue({ id: '1', name: 'Admin', isSystem: true, isActive: true, permissions: [] });
            await expect(service.remove('1')).rejects.toThrow(BadRequestException);
        });

        it('should soft-delete non-system role', async () => {
            const role = { id: '1', name: 'Custom', isSystem: false, isActive: true, permissions: [] };
            mockRoleRepo.findOne.mockResolvedValue(role);

            await service.remove('1', 'admin-id');
            expect(mockRoleRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
        });
    });
});
