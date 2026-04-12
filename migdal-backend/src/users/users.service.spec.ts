import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { createMockRepository, createMockQueryBuilder, createMockWsGateway } from '../test-utils/mock.factory';
import { UsersGateway } from '../websocket/gateways/users.gateway';
import { AuditService } from '../audit/audit.service';
import * as hashUtil from '../common/utils/hash.util';

describe('UsersService', () => {
    let service: UsersService;
    let mockRepo: ReturnType<typeof createMockRepository>;
    let mockWsGateway: ReturnType<typeof createMockWsGateway>;
    let mockAuditService: any;

    beforeEach(async () => {
        mockRepo = createMockRepository();
        mockWsGateway = createMockWsGateway();
        mockAuditService = {
            log: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UsersService,
                { provide: getRepositoryToken(User), useValue: mockRepo },
                { provide: UsersGateway, useValue: mockWsGateway },
                { provide: AuditService, useValue: mockAuditService },
            ],
        }).compile();

        service = module.get<UsersService>(UsersService);
    });

    describe('findAll', () => {
        it('should return paginated users', async () => {
            const users = [{ id: '1', username: 'alice', passwordHash: 'h', firstName: 'A', lastName: 'B', roles: [] }];
            const qb = createMockQueryBuilder(users, 1);
            mockRepo.createQueryBuilder.mockReturnValue(qb);

            const result = await service.findAll({ page: 1, limit: 10 } as any);

            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(result.page).toBe(1);
            expect((result.items[0] as any).passwordHash).toBeUndefined();
        });
    });

    describe('findById', () => {
        it('should return user without passwordHash', async () => {
            mockRepo.findOne.mockResolvedValue({
                id: '1', username: 'alice', passwordHash: 'secret', firstName: 'A', lastName: 'B',
                roles: [{ name: 'Admin', permissions: [] }],
            });

            const result = await service.findById('1');
            expect(result.username).toBe('alice');
            expect((result as any).passwordHash).toBeUndefined();
        });

        it('should throw NotFoundException for missing user', async () => {
            mockRepo.findOne.mockResolvedValue(null);
            await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
        });
    });

    describe('findByUsername', () => {
        it('should return user by username', async () => {
            const user = { id: '1', username: 'alice', roles: [] };
            mockRepo.findOne.mockResolvedValue(user);

            const result = await service.findByUsername('alice');
            expect(result).toEqual(user);
        });

        it('should return null for unknown username', async () => {
            mockRepo.findOne.mockResolvedValue(null);
            const result = await service.findByUsername('unknown');
            expect(result).toBeNull();
        });
    });

    describe('create', () => {
        it('should throw ConflictException for duplicate username', async () => {
            mockRepo.findOne.mockResolvedValue({ id: 'existing' });
            await expect(service.create({
                username: 'alice', password: 'Pass1234', firstName: 'A', lastName: 'B',
            } as any)).rejects.toThrow(ConflictException);
        });

        it('should create user and broadcast', async () => {
            mockRepo.findOne
                .mockResolvedValueOnce(null) // no duplicate
                .mockResolvedValueOnce({ // findById after save
                    id: 'new-id', username: 'bob', firstName: 'Bob', lastName: 'Smith',
                    roles: [], isActive: true,
                });
            mockRepo.save.mockResolvedValue({ id: 'new-id' });
            jest.spyOn(hashUtil, 'hashPassword').mockResolvedValue('hashed');

            const result = await service.create({
                username: 'bob', password: 'Pass1234', firstName: 'Bob', lastName: 'Smith',
            } as any, 'admin-id');

            expect(result.username).toBe('bob');
            expect(mockWsGateway.broadcastToAll).toHaveBeenCalledWith(
                'users:user:created',
                expect.objectContaining({ username: 'bob' }),
            );
        });
    });

    describe('update', () => {
        it('should throw ConflictException when changing to existing username', async () => {
            mockRepo.findOne
                .mockResolvedValueOnce({ id: '1', username: 'alice', isActive: true, roles: [], passwordHash: 'h' }) // findById
                .mockResolvedValueOnce({ id: '2', username: 'bob' }); // dup check
            await expect(service.update('1', { username: 'bob' } as any)).rejects.toThrow(ConflictException);
        });

        it('should update and broadcast', async () => {
            const user = { id: '1', username: 'alice', isActive: true, roles: [{ name: 'Admin', permissions: [] }], passwordHash: 'h' };
            mockRepo.findOne.mockResolvedValue(user);
            mockRepo.save.mockResolvedValue(user);

            const result = await service.update('1', { firstName: 'Alice2' } as any, 'admin-id');

            expect(mockRepo.save).toHaveBeenCalled();
            expect(mockWsGateway.broadcastToAll).toHaveBeenCalledWith(
                'users:user:updated',
                expect.objectContaining({ id: '1' }),
            );
        });
    });

    describe('remove', () => {
        it('should soft-delete user by setting isActive to false', async () => {
            const user = { id: '1', username: 'alice', isActive: true, roles: [], passwordHash: 'h' };
            mockRepo.findOne.mockResolvedValue(user);
            mockRepo.save.mockResolvedValue({ ...user, isActive: false });
            (mockRepo as any).manager = { query: jest.fn().mockResolvedValue(undefined) };

            await service.remove('1', 'admin-id');

            expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
            expect(mockRepo.delete).not.toHaveBeenCalled();
            expect(mockWsGateway.broadcastToAll).toHaveBeenCalledWith('users:user:deleted', { id: '1' });
        });

        it('should revoke refresh tokens on soft-delete', async () => {
            const user = { id: '1', username: 'alice', isActive: true, roles: [], passwordHash: 'h' };
            mockRepo.findOne.mockResolvedValue(user);
            mockRepo.save.mockResolvedValue({ ...user, isActive: false });
            const mockQuery = jest.fn().mockResolvedValue(undefined);
            (mockRepo as any).manager = { query: mockQuery };

            await service.remove('1', 'admin-id');

            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining('RefreshTokens'),
                ['1'],
            );
        });

        it('should throw BadRequestException when user is already deactivated', async () => {
            const user = { id: '1', username: 'alice', isActive: false, roles: [], passwordHash: 'h' };
            mockRepo.findOne.mockResolvedValue(user);

            await expect(service.remove('1', 'admin-id')).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException when deleting own account', async () => {
            const user = { id: 'admin-id', username: 'admin', isActive: true, roles: [], passwordHash: 'h' };
            mockRepo.findOne.mockResolvedValue(user);

            await expect(service.remove('admin-id', 'admin-id')).rejects.toThrow(BadRequestException);
        });

        it('should throw NotFoundException for missing user', async () => {
            mockRepo.findOne.mockResolvedValue(null);
            await expect(service.remove('nonexistent', 'admin-id')).rejects.toThrow(NotFoundException);
        });
    });

    describe('assignRoles', () => {
        it('should assign roles to user', async () => {
            const user = { id: '1', username: 'alice', isActive: true, roles: [], passwordHash: 'h' };
            mockRepo.findOne.mockResolvedValue(user);
            mockRepo.save.mockResolvedValue(user);

            await service.assignRoles('1', ['role-1', 'role-2'], 'admin-id');

            expect(mockRepo.save).toHaveBeenCalledWith(
                expect.objectContaining({ roles: [{ id: 'role-1' }, { id: 'role-2' }] }),
            );
        });

        it('should audit log on assignRoles', async () => {
            const user = { id: 'u-1', username: 'test', isActive: true, roles: [{ id: 'r-old' }] };
            mockRepo.findOne.mockResolvedValue(user);
            mockRepo.save.mockResolvedValue(user);
            await service.assignRoles('u-1', ['r-new'], 'admin-1');
            expect(mockAuditService.log).toHaveBeenCalledWith(expect.objectContaining({
                module: 'users', action: 'ASSIGN_ROLES', entity: 'User', entityId: 'u-1',
                oldValue: expect.objectContaining({ roleIds: ['r-old'] }),
                newValue: expect.objectContaining({ roleIds: ['r-new'] }),
            }));
        });
    });

    describe('updateLastLogin', () => {
        it('should update lastLoginAt', async () => {
            await service.updateLastLogin('user-1');
            expect(mockRepo.update).toHaveBeenCalledWith('user-1', expect.objectContaining({ lastLoginAt: expect.any(Date) }));
        });
    });

    describe('update with isActive', () => {
        it('should deactivate a user', async () => {
            const user = { id: '1', username: 'alice', isActive: true, roles: [{ name: 'Admin', permissions: [] }], passwordHash: 'h' };
            mockRepo.findOne.mockResolvedValue(user);
            mockRepo.save.mockResolvedValue({ ...user, isActive: false });

            const result = await service.update('1', { isActive: false } as any, 'admin-id');

            expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
            expect(mockWsGateway.broadcastToAll).toHaveBeenCalledWith(
                'users:user:updated',
                expect.objectContaining({ id: '1' }),
            );
        });

        it('should activate a user', async () => {
            const user = { id: '1', username: 'alice', isActive: false, roles: [], passwordHash: 'h' };
            mockRepo.findOne.mockResolvedValue(user);
            mockRepo.save.mockResolvedValue({ ...user, isActive: true });

            const result = await service.update('1', { isActive: true } as any, 'admin-id');

            expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
        });

        it('should throw BadRequestException when changing own active status', async () => {
            const user = { id: 'admin-id', username: 'admin', isActive: true, roles: [], passwordHash: 'h' };
            mockRepo.findOne.mockResolvedValue(user);

            await expect(service.update('admin-id', { isActive: false } as any, 'admin-id'))
                .rejects.toThrow(BadRequestException);
        });

        it('should throw NotFoundException for missing user', async () => {
            mockRepo.findOne.mockResolvedValue(null);
            await expect(service.update('nonexistent', { isActive: false } as any, 'admin-id'))
                .rejects.toThrow(NotFoundException);
        });
    });
});
