import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { Permission } from './entities/permission.entity';
import { createMockRepository } from '../test-utils/mock.factory';

describe('PermissionsService', () => {
    let service: PermissionsService;
    let mockRepo: ReturnType<typeof createMockRepository>;

    beforeEach(async () => {
        mockRepo = createMockRepository();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PermissionsService,
                { provide: getRepositoryToken(Permission), useValue: mockRepo },
            ],
        }).compile();

        service = module.get<PermissionsService>(PermissionsService);
    });

    describe('findAll', () => {
        it('should return active permissions ordered by module and action', async () => {
            const perms = [
                { id: '1', key: 'users.read', module: 'users', action: 'read', isActive: true },
                { id: '2', key: 'users.write', module: 'users', action: 'write', isActive: true },
            ];
            mockRepo.find.mockResolvedValue(perms);

            const result = await service.findAll();

            expect(result).toHaveLength(2);
            expect(mockRepo.find).toHaveBeenCalledWith({
                where: { isActive: true },
                order: { module: 'ASC', action: 'ASC' },
            });
        });
    });

    describe('findById', () => {
        it('should return permission by id', async () => {
            mockRepo.findOne.mockResolvedValue({ id: '1', key: 'users.read' });
            const result = await service.findById('1');
            expect(result.key).toBe('users.read');
        });

        it('should throw NotFoundException when not found', async () => {
            mockRepo.findOne.mockResolvedValue(null);
            await expect(service.findById('bad')).rejects.toThrow(NotFoundException);
        });
    });

    describe('findByKeys', () => {
        it('should return permissions matching keys', async () => {
            const perms = [{ id: '1', key: 'users.read' }];
            mockRepo.findBy.mockResolvedValue(perms);

            const result = await service.findByKeys(['users.read']);
            expect(result).toEqual(perms);
        });
    });

    describe('findGroupedByModule', () => {
        it('should group permissions by module', async () => {
            const perms = [
                { id: '1', key: 'users.read', module: 'users', action: 'read', isActive: true },
                { id: '2', key: 'users.write', module: 'users', action: 'write', isActive: true },
                { id: '3', key: 'roles.read', module: 'roles', action: 'read', isActive: true },
            ];
            mockRepo.find.mockResolvedValue(perms);

            const result = await service.findGroupedByModule();

            expect(Object.keys(result)).toEqual(['users', 'roles']);
            expect(result['users']).toHaveLength(2);
            expect(result['roles']).toHaveLength(1);
        });
    });
});
