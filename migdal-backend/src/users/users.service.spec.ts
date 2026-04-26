import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { createMockRepository, createMockQueryBuilder, createMockWsGateway } from '../test-utils/mock.factory';
import { UsersGateway } from '../websocket/gateways/users.gateway';
import { AuditService } from '../audit/audit.service';
import * as hashUtil from '../common/utils/hash.util';

describe('UsersService', () => {
    let service: UsersService;
    let mockRepo: ReturnType<typeof createMockRepository>;
    let mockRoleRepo: ReturnType<typeof createMockRepository>;
    let mockWsGateway: ReturnType<typeof createMockWsGateway>;
    let mockAuditService: any;

    beforeEach(async () => {
        mockRepo = createMockRepository();
        mockRoleRepo = createMockRepository();
        mockWsGateway = createMockWsGateway();
        mockAuditService = {
            log: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UsersService,
                { provide: getRepositoryToken(User), useValue: mockRepo },
                { provide: getRepositoryToken(Role), useValue: mockRoleRepo },
                { provide: UsersGateway, useValue: mockWsGateway },
                { provide: AuditService, useValue: mockAuditService },
            ],
        }).compile();

        service = module.get<UsersService>(UsersService);
    });

    describe('findAll', () => {
        it('should return paginated users', async () => {
            const users = [{ id: '1', username: 'alice', passwordHash: 'h', firstName: 'A', lastName: 'B', role: null }];
            const qb = createMockQueryBuilder(users, 1);
            mockRepo.createQueryBuilder.mockReturnValue(qb);

            const result = await service.findAll({ page: 1, limit: 10 } as any);

            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(result.page).toBe(1);
            expect((result.items[0] as any).passwordHash).toBeUndefined();
            expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('user.role', 'role');
            expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('user.sector', 'sector');
        });
    });

    describe('findById', () => {
        it('should return user without passwordHash', async () => {
            mockRepo.findOne.mockResolvedValue({
                id: '1', username: 'alice', passwordHash: 'secret', firstName: 'A', lastName: 'B',
                role: { name: 'Admin', permissions: [] },
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
            const user = { id: '1', username: 'alice', role: null };
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
                    role: null, isActive: true,
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
                .mockResolvedValueOnce({ id: '1', username: 'alice', isActive: true, role: null, passwordHash: 'h' }) // findById
                .mockResolvedValueOnce({ id: '2', username: 'bob' }); // dup check
            await expect(service.update('1', { username: 'bob' } as any)).rejects.toThrow(ConflictException);
        });

        it('should update and broadcast', async () => {
            const user = { id: '1', username: 'alice', isActive: true, role: { name: 'Admin', permissions: [] }, passwordHash: 'h' };
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

    describe('assignRole', () => {
        it('should assign role to user', async () => {
            const user = { id: '1', username: 'alice', isActive: true, roleId: null, roles: [], passwordHash: 'h' };
            mockRepo.findOne.mockResolvedValue(user as any);
            mockRoleRepo.find.mockResolvedValue([{ id: 'role-1', name: 'Admin' }]);
            mockRepo.save.mockResolvedValue({ ...user, roleId: 'role-1' });

            await service.assignRole('1', 'role-1', 'admin-id');

            expect(mockRepo.save).toHaveBeenCalledWith(
                expect.objectContaining({ roleId: 'role-1', roles: expect.any(Array) }),
            );
        });

        it('should audit log on assignRole', async () => {
            const user = { id: 'u-1', username: 'test', isActive: true, roleId: 'r-old', roles: [{ id: 'r-old', name: 'Old' }] };
            mockRepo.findOne.mockResolvedValue(user as any);
            mockRoleRepo.find.mockResolvedValue([{ id: 'r-new', name: 'New' }]);
            mockRepo.save.mockResolvedValue({ ...user, roleId: 'r-new' });
            await service.assignRole('u-1', 'r-new', 'admin-1');
            expect(mockAuditService.log).toHaveBeenCalledWith(expect.objectContaining({
                module: 'users', action: 'ASSIGN_ROLE', entity: 'User', entityId: 'u-1',
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
            const user = { id: '1', username: 'alice', isActive: true, role: { name: 'Admin', permissions: [] }, passwordHash: 'h' };
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
            const user = { id: '1', username: 'alice', isActive: false, role: null, passwordHash: 'h' };
            mockRepo.findOne.mockResolvedValue(user);
            mockRepo.save.mockResolvedValue({ ...user, isActive: true });

            const result = await service.update('1', { isActive: true } as any, 'admin-id');

            expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
        });

        it('should throw BadRequestException when changing own active status', async () => {
            const user = { id: 'admin-id', username: 'admin', isActive: true, role: null, passwordHash: 'h' };
            mockRepo.findOne.mockResolvedValue(user);

            await expect(service.update('admin-id', { isActive: false } as any, 'admin-id'))
                .rejects.toThrow(BadRequestException);
        });

        it('should throw NotFoundException for missing user', async () => {
            mockRepo.findOne.mockResolvedValue(null);
            await expect(service.update('nonexistent', { isActive: false } as any, 'admin-id'))
                .rejects.toThrow(NotFoundException);
        });

        it('should block direct update for AD imported users', async () => {
            const adUser = {
                id: 'ad-user-1',
                username: 'ad.user',
                firstName: 'Ad',
                lastName: 'User',
                isActive: true,
                syncSource: 'ad',
                role: null,
                roles: [],
                passwordHash: 'h',
            };
            mockRepo.findOne.mockResolvedValue(adUser);

            await expect(service.update('ad-user-1', { firstName: 'Changed' } as any, 'admin-id'))
                .rejects.toThrow(BadRequestException);
        });
    });
});
