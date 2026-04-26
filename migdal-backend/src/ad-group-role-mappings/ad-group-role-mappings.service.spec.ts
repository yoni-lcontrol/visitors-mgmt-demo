import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AdGroupRoleMappingsService } from './ad-group-role-mappings.service';
import { AdGroupRoleMapping } from './entities/ad-group-role-mapping.entity';
import { Role } from '../roles/entities/role.entity';
import { AdConfiguration } from '../settings/entities/ad-configuration.entity';
import { createMockRepository } from '../test-utils/mock.factory';
import { AuditService } from '../audit/audit.service';

describe('AdGroupRoleMappingsService', () => {
    let service: AdGroupRoleMappingsService;
    let mockMappingRepo: ReturnType<typeof createMockRepository>;
    let mockRoleRepo: ReturnType<typeof createMockRepository>;
    let mockAdConfigRepo: ReturnType<typeof createMockRepository>;

    beforeEach(async () => {
        mockMappingRepo = createMockRepository();
        mockRoleRepo = createMockRepository();
        mockAdConfigRepo = createMockRepository();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AdGroupRoleMappingsService,
                { provide: getRepositoryToken(AdGroupRoleMapping), useValue: mockMappingRepo },
                { provide: getRepositoryToken(Role), useValue: mockRoleRepo },
                { provide: getRepositoryToken(AdConfiguration), useValue: mockAdConfigRepo },
                { provide: AuditService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
            ],
        }).compile();

        service = module.get<AdGroupRoleMappingsService>(AdGroupRoleMappingsService);
    });

    it('should return mappings sorted by groupName', async () => {
        mockMappingRepo.find.mockResolvedValue([{ id: 1, groupName: 'A' }]);

        const result = await service.findAll();

        expect(result).toHaveLength(1);
        expect(mockMappingRepo.find).toHaveBeenCalledWith(
            expect.objectContaining({ order: { adSourceId: 'ASC', groupName: 'ASC' } }),
        );
    });

    it('should validate role existence on create', async () => {
        mockRoleRepo.findOne.mockResolvedValue(null);

        await expect(service.create({ groupName: 'Reception', roleId: '4f4bb24f-abf8-4f90-b701-0299043d0814' }))
            .rejects.toThrow(BadRequestException);
    });

    it('should reject duplicate groupName on create', async () => {
        mockAdConfigRepo.findOne.mockResolvedValue(null);
        mockRoleRepo.findOne.mockResolvedValue({ id: 'r1', isActive: true });
        mockMappingRepo.findOne.mockResolvedValue({ id: 2, groupName: 'Reception' });

        await expect(service.create({ groupName: 'Reception', roleId: '4f4bb24f-abf8-4f90-b701-0299043d0814' }))
            .rejects.toThrow(ConflictException);
    });

    it('should create mapping successfully', async () => {
        mockAdConfigRepo.findOne.mockResolvedValue(null);
        mockRoleRepo.findOne.mockResolvedValue({ id: 'r1', isActive: true });
        mockMappingRepo.findOne
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: 10, groupName: 'Reception', roleId: 'r1', role: { id: 'r1', name: 'Operator' } });
        mockMappingRepo.save.mockResolvedValue({ id: 10, groupName: 'Reception', roleId: 'r1' });

        const result = await service.create({ groupName: '  Reception ', roleId: 'r1' } as any, 'user-1');

        expect(result.id).toBe(10);
        expect(mockMappingRepo.create).toHaveBeenCalledWith(expect.objectContaining({ groupName: 'Reception' }));
    });

    it('should throw NotFoundException for missing id', async () => {
        mockMappingRepo.findOne.mockResolvedValue(null);

        await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });

    it('should delete mapping', async () => {
        mockMappingRepo.findOne.mockResolvedValue({ id: 3, groupName: 'Reception', roleId: 'r1' });
        mockMappingRepo.remove.mockResolvedValue(undefined);

        await service.remove(3, 'user-1');

        expect(mockMappingRepo.remove).toHaveBeenCalled();
    });
});
