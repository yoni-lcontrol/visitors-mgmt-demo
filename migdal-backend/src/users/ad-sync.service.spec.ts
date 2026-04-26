import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AdSyncService, AdSyncResult } from './ad-sync.service';
import { AdSyncAdapterService, AdUserEntry, AdConnectionException } from './ad-sync-adapter.service';
import { AuditService } from '../audit/audit.service';
import { UsersGateway } from '../websocket/gateways/users.gateway';
import { User } from './entities/user.entity';
import { AdConfiguration } from '../settings/entities/ad-configuration.entity';
import { SectorsService } from '../sectors/sectors.service';
import { AdGroupRoleMapping } from '../ad-group-role-mappings/entities/ad-group-role-mapping.entity';

describe('AdSyncService', () => {
    let service: AdSyncService;
    let mockUserRepo: Record<string, jest.Mock>;
    let mockAdConfigRepo: Record<string, jest.Mock>;
    let mockAdGroupRoleMappingRepo: Record<string, jest.Mock>;
    let mockAdAdapter: Record<string, jest.Mock>;
    let mockAuditService: Record<string, jest.Mock>;
    let mockSectorsService: Record<string, jest.Mock>;

    const makeConfig = (overrides: Partial<AdConfiguration> = {}): AdConfiguration => ({
        id: 'config-1',
        name: 'TestAD',
        domain: 'test.local',
        ldapUrl: 'ldap://dc1:389',
        baseDn: 'DC=test,DC=local',
        username: 'admin',
        password: 'pass',
        port: 389,
        useSsl: false,
        isActive: true,
        description: null,
        targetGroupsJson: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
        ...overrides,
    } as AdConfiguration);

    const makeAdUser = (overrides: Partial<AdUserEntry> = {}): AdUserEntry => ({
        externalId: 'jdoe',
        username: 'jdoe',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.local',
        phone: '123',
        department: 'IT',
        title: 'Developer',
        idNumber: null,
        company: null,
        groupNames: [],
        groupExternalIds: [],
        isDisabled: false,
        ...overrides,
    });

    const makeLocalUser = (overrides: Partial<User> = {}): User => ({
        id: 'user-1',
        username: 'jdoe',
        passwordHash: 'hash',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.local',
        phone: '123',
        department: 'IT',
        title: 'Developer',
        idNumber: null,
        lastLoginAt: null,
        adSourceId: 'config-1',
        adExternalId: 'jdoe',
        lastSyncedAt: new Date('2026-01-01'),
        syncSource: 'ad',
        isActive: true,
        sectorId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
        roleId: null,
        role: null,
        roles: [],
        ...overrides,
    } as unknown as User);

    /** Helper to set up userRepo.find mock based on query argument */
    function setupUserRepoFind(
        adSourceUsers: User[] = [],
        localSourceUsers: User[] = [],
    ): void {
        mockUserRepo.find = jest.fn((options: Record<string, any>) => {
            const where = options?.where ?? {};
            if ('adSourceId' in where) return Promise.resolve([...adSourceUsers]);
            if ('syncSource' in where) return Promise.resolve([...localSourceUsers]);
            return Promise.resolve([]);
        });
    }

    const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        whereInIds: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ generatedMaps: [] }),
    };

    const mockQrManager = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
        save: jest.fn((Entity: any, data: any) => {
            if (Array.isArray(data)) {
                return Promise.resolve(data.map(e => ({ id: e.id || 'new-id', ...e })));
            }
            return Promise.resolve({ id: data?.id || 'new-id', ...data });
        }),
    };

    const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: mockQrManager,
    };

    const mockDataSource = {
        createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    beforeEach(async () => {
        mockQueryBuilder.update.mockReturnValue(mockQueryBuilder);
        mockQueryBuilder.set.mockReturnValue(mockQueryBuilder);
        mockQueryBuilder.whereInIds.mockReturnValue(mockQueryBuilder);
        mockQueryBuilder.insert.mockReturnValue(mockQueryBuilder);
        mockQueryBuilder.into.mockReturnValue(mockQueryBuilder);
        mockQueryBuilder.values.mockReturnValue(mockQueryBuilder);
        mockQueryBuilder.execute.mockResolvedValue({ generatedMaps: [] });

        mockQueryRunner.connect.mockResolvedValue(undefined);
        mockQueryRunner.startTransaction.mockResolvedValue(undefined);
        mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
        mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
        mockQueryRunner.release.mockResolvedValue(undefined);

        mockUserRepo = {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue(null),
            create: jest.fn((data) => ({ id: 'new-id', ...data })),
            save: jest.fn((entityOrArray) => {
                if (Array.isArray(entityOrArray)) {
                    return Promise.resolve(entityOrArray.map(e => ({ id: e.id || 'new-id', ...e })));
                }
                return Promise.resolve({ id: entityOrArray.id || 'new-id', ...entityOrArray });
            }),
            update: jest.fn().mockResolvedValue(undefined),
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
        };

        mockAdConfigRepo = {
            find: jest.fn().mockResolvedValue([]),
        };

        mockAdGroupRoleMappingRepo = {
            find: jest.fn().mockResolvedValue([]),
        };

        mockAdAdapter = {
            fetchUsers: jest.fn().mockResolvedValue([]),
            validateConfig: jest.fn().mockReturnValue([]),
        };

        mockAuditService = {
            log: jest.fn().mockResolvedValue(undefined),
        };

        mockSectorsService = {
            findOrCreateByName: jest.fn().mockResolvedValue({ id: 'sector-1', name: 'Test' }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AdSyncService,
                { provide: getRepositoryToken(User), useValue: mockUserRepo },
                { provide: getRepositoryToken(AdConfiguration), useValue: mockAdConfigRepo },
                { provide: getRepositoryToken(AdGroupRoleMapping), useValue: mockAdGroupRoleMappingRepo },
                { provide: AdSyncAdapterService, useValue: mockAdAdapter },
                { provide: AuditService, useValue: mockAuditService },
                { provide: SectorsService, useValue: mockSectorsService },
                { provide: UsersGateway, useValue: { broadcastToAll: jest.fn() } },
                { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
                { provide: DataSource, useValue: mockDataSource },
            ],
        }).compile();

        service = module.get<AdSyncService>(AdSyncService);
    });

    describe('syncAll', () => {
        it('should return empty result when no AD configurations exist', async () => {
            mockAdConfigRepo.find.mockResolvedValue([]);
            const result = await service.syncAll();
            expect(result.configsProcessed).toBe(0);
            expect(result.configsFailed).toBe(0);
            expect(result.details).toEqual([]);
            expect(result.durationMs).toBeGreaterThanOrEqual(0);
        });

        it('should query only active configs ordered by name', async () => {
            mockAdConfigRepo.find.mockResolvedValue([]);
            await service.syncAll();
            expect(mockAdConfigRepo.find).toHaveBeenCalledWith({
                where: { isActive: true },
                order: { name: 'ASC' },
            });
        });

        it('should process multiple AD configurations independently', async () => {
            const config1 = makeConfig({ id: 'c1', name: 'AD1' });
            const config2 = makeConfig({ id: 'c2', name: 'AD2' });
            mockAdConfigRepo.find.mockResolvedValue([config1, config2]);

            mockAdAdapter.fetchUsers
                .mockResolvedValueOnce([makeAdUser({ externalId: 'user1', username: 'user1' })])
                .mockResolvedValueOnce([makeAdUser({ externalId: 'user2', username: 'user2' })]);

            setupUserRepoFind();

            const result = await service.syncAll();
            expect(result.configsProcessed).toBe(2);
            expect(result.totalCreated).toBe(2);
            expect(result.details).toHaveLength(2);
        });

        it('should continue processing other configs when one fails', async () => {
            const config1 = makeConfig({ id: 'c1', name: 'FailAD' });
            const config2 = makeConfig({ id: 'c2', name: 'OkAD' });
            mockAdConfigRepo.find.mockResolvedValue([config1, config2]);

            mockAdAdapter.fetchUsers
                .mockRejectedValueOnce(new AdConnectionException('AD_CONNECTION_FAILED', 'connection refused'))
                .mockResolvedValueOnce([makeAdUser({ externalId: 'user2', username: 'user2' })]);

            setupUserRepoFind();

            const result = await service.syncAll();
            expect(result.configsFailed).toBe(1);
            expect(result.configsProcessed).toBe(1);
            expect(result.totalCreated).toBe(1);
            expect(result.details[0].error).toContain('connection refused');
            expect(result.details[1].error).toBeNull();
        });

        it('should log audit entry after sync', async () => {
            mockAdConfigRepo.find.mockResolvedValue([makeConfig()]);
            mockAdAdapter.fetchUsers.mockResolvedValue([]);
            setupUserRepoFind();

            await service.syncAll('admin-id');
            expect(mockAuditService.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 'admin-id',
                    module: 'users',
                    action: 'UPDATE',
                    entity: 'AdSync',
                }),
            );
        });

        it('should include durationMs in result', async () => {
            mockAdConfigRepo.find.mockResolvedValue([]);
            const result = await service.syncAll();
            expect(typeof result.durationMs).toBe('number');
            expect(result.durationMs).toBeGreaterThanOrEqual(0);
        });
    });

    describe('sync - create users', () => {
        it('should create user when AD user not found locally', async () => {
            const config = makeConfig();
            mockAdConfigRepo.find.mockResolvedValue([config]);
            mockAdAdapter.fetchUsers.mockResolvedValue([
                makeAdUser({ externalId: 'newuser', username: 'newuser' }),
            ]);
            setupUserRepoFind();

            const result = await service.syncAll();
            expect(result.totalCreated).toBe(1);
            expect(mockUserRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    username: 'newuser',
                    adSourceId: 'config-1',
                    adExternalId: 'newuser',
                    syncSource: 'ad',
                }),
            );
            // New users go through bulk insert via DataSource query runner
            expect(mockDataSource.createQueryRunner).toHaveBeenCalled();
            expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
        });

        it('should set department and title on created user', async () => {
            const config = makeConfig();
            mockAdConfigRepo.find.mockResolvedValue([config]);
            mockAdAdapter.fetchUsers.mockResolvedValue([
                makeAdUser({ externalId: 'newuser', username: 'newuser', department: 'Sales', title: 'Manager' }),
            ]);
            setupUserRepoFind();

            await service.syncAll();
            expect(mockUserRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    department: 'Sales',
                    title: 'Manager',
                }),
            );
        });

        it('should skip AD users with empty externalId', async () => {
            const config = makeConfig();
            mockAdConfigRepo.find.mockResolvedValue([config]);
            mockAdAdapter.fetchUsers.mockResolvedValue([
                makeAdUser({ externalId: '', username: '' }),
            ]);
            setupUserRepoFind();

            const result = await service.syncAll();
            expect(result.totalSkipped).toBe(1);
            expect(result.totalCreated).toBe(0);
        });
    });

    describe('sync - update users', () => {
        it('should update user matched by adExternalId', async () => {
            const config = makeConfig();
            const localUser = makeLocalUser({ firstName: 'OldFirst' });
            mockAdConfigRepo.find.mockResolvedValue([config]);
            mockAdAdapter.fetchUsers.mockResolvedValue([
                makeAdUser({ firstName: 'NewFirst' }),
            ]);
            setupUserRepoFind([localUser], []);

            const result = await service.syncAll();
            expect(result.totalUpdated).toBe(1);
            // Updated users go through flushUpdates → queryRunner.manager.save
            expect(mockQrManager.save).toHaveBeenCalledWith(
                User,
                expect.arrayContaining([
                    expect.objectContaining({ firstName: 'NewFirst' }),
                ]),
            );
        });

        it('should match existing local user by username on first sync', async () => {
            const config = makeConfig();
            const localUser = makeLocalUser({
                syncSource: 'local',
                adSourceId: null,
                adExternalId: null,
            });
            mockAdConfigRepo.find.mockResolvedValue([config]);
            mockAdAdapter.fetchUsers.mockResolvedValue([makeAdUser()]);
            setupUserRepoFind([], [localUser]);

            const result = await service.syncAll();
            expect(result.totalUpdated).toBe(1);
            expect(mockQrManager.save).toHaveBeenCalledWith(
                User,
                expect.arrayContaining([
                    expect.objectContaining({
                        syncSource: 'ad',
                        adSourceId: 'config-1',
                        adExternalId: 'jdoe',
                    }),
                ]),
            );
        });

        it('should skip user when nothing changed', async () => {
            const config = makeConfig();
            const localUser = makeLocalUser(); // already has matching data
            mockAdConfigRepo.find.mockResolvedValue([config]);
            mockAdAdapter.fetchUsers.mockResolvedValue([makeAdUser()]);
            setupUserRepoFind([localUser], []);

            const result = await service.syncAll();
            expect(result.totalSkipped).toBe(1);
            // Should still update lastSyncedAt via bulk query
            expect(mockUserRepo.createQueryBuilder).toHaveBeenCalled();
            expect(mockQueryBuilder.whereInIds).toHaveBeenCalledWith([localUser.id]);
        });

        it('should reactivate previously deactivated user found in AD', async () => {
            const config = makeConfig();
            const localUser = makeLocalUser({ isActive: false });
            mockAdConfigRepo.find.mockResolvedValue([config]);
            mockAdAdapter.fetchUsers.mockResolvedValue([makeAdUser()]);
            setupUserRepoFind([localUser], []);

            const result = await service.syncAll();
            expect(result.totalUpdated).toBe(1);
            expect(mockQrManager.save).toHaveBeenCalledWith(
                User,
                expect.arrayContaining([
                    expect.objectContaining({ isActive: true }),
                ]),
            );
        });

        it('should not overwrite local fields with empty AD values', async () => {
            const config = makeConfig();
            const localUser = makeLocalUser({ email: 'local@test.com', phone: '999' });
            mockAdConfigRepo.find.mockResolvedValue([config]);
            mockAdAdapter.fetchUsers.mockResolvedValue([
                makeAdUser({ email: null, phone: null }),
            ]);
            setupUserRepoFind([localUser], []);

            await service.syncAll();
            // Email and phone should NOT be overwritten since AD returns null
            // The update path should only touch lastSyncedAt via bulk query
            expect(mockUserRepo.createQueryBuilder).toHaveBeenCalled();
            expect(mockQueryBuilder.whereInIds).toHaveBeenCalledWith([localUser.id]);
        });

        it('should map roles from AD group names using mappings table', async () => {
            const config = makeConfig();
            const localUser = makeLocalUser({
                firstName: 'OldFirst',
                roleId: 'role-local',
                roles: [{ id: 'role-local', name: 'Local Role', isActive: true }] as any,
            });
            mockAdConfigRepo.find.mockResolvedValue([config]);
            mockAdGroupRoleMappingRepo.find.mockResolvedValue([
                {
                    id: 1,
                    groupName: 'Visitors Operators',
                    roleId: 'role-ad',
                    role: { id: 'role-ad', name: 'AD Role', isActive: true },
                },
            ]);
            mockAdAdapter.fetchUsers.mockResolvedValue([
                makeAdUser({
                    firstName: 'NewFirst',
                    groupNames: ['Visitors Operators'],
                }),
            ]);
            setupUserRepoFind([localUser], []);

            await service.syncAll();

            expect(mockQrManager.save).toHaveBeenCalledWith(
                User,
                expect.arrayContaining([
                    expect.objectContaining({
                        firstName: 'NewFirst',
                        roleId: 'role-ad',
                        roles: expect.arrayContaining([
                            expect.objectContaining({ id: 'role-ad' }),
                        ]),
                    }),
                ]),
            );
        });

        it('should assign mapped roles for newly created AD user', async () => {
            const config = makeConfig();
            mockAdConfigRepo.find.mockResolvedValue([config]);
            mockAdGroupRoleMappingRepo.find.mockResolvedValue([
                {
                    id: 1,
                    groupName: 'Reception',
                    roleId: 'role-reception',
                    role: { id: 'role-reception', name: 'Reception Role', isActive: true },
                },
            ]);
            mockAdAdapter.fetchUsers.mockResolvedValue([
                makeAdUser({
                    externalId: 'newuser',
                    username: 'newuser',
                    groupNames: ['Reception'],
                }),
            ]);
            setupUserRepoFind();

            await service.syncAll();

            expect(mockUserRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    username: 'newuser',
                    roleId: 'role-reception',
                    roles: expect.arrayContaining([
                        expect.objectContaining({ id: 'role-reception' }),
                    ]),
                }),
            );
        });
    });

    describe('sync - deactivate users', () => {
        it('should deactivate local AD-sourced user not found in AD', async () => {
            const config = makeConfig();
            const localUser = makeLocalUser({ id: 'user-1', adExternalId: 'removed-user' });
            mockAdConfigRepo.find.mockResolvedValue([config]);
            // AD returns different users (not 'removed-user')
            mockAdAdapter.fetchUsers.mockResolvedValue([
                makeAdUser({ externalId: 'different-user', username: 'different-user' }),
            ]);
            setupUserRepoFind([localUser], []);

            const result = await service.syncAll();
            expect(result.totalDeactivated).toBe(1);
            // Deactivation now uses bulk UPDATE query
            expect(mockUserRepo.createQueryBuilder).toHaveBeenCalled();
        });

        it('should not deactivate already-inactive users', async () => {
            const config = makeConfig();
            const localUser = makeLocalUser({ id: 'user-1', isActive: false, adExternalId: 'gone' });
            mockAdConfigRepo.find.mockResolvedValue([config]);
            mockAdAdapter.fetchUsers.mockResolvedValue([]);
            setupUserRepoFind([localUser], []);

            const result = await service.syncAll();
            expect(result.totalDeactivated).toBe(0);
        });

        it('should not deactivate when AD returns empty (safety check)', async () => {
            const config = makeConfig();
            const localUser = makeLocalUser();
            mockAdConfigRepo.find.mockResolvedValue([config]);
            mockAdAdapter.fetchUsers.mockResolvedValue([]); // Empty result
            setupUserRepoFind([localUser], []);

            const result = await service.syncAll();
            // When AD returns 0 users, we skip sync for safety
            expect(result.totalDeactivated).toBe(0);
        });
    });

    describe('sync - error handling', () => {
        it('should capture AD connection error in config result', async () => {
            const config = makeConfig({ name: 'BrokenAD' });
            mockAdConfigRepo.find.mockResolvedValue([config]);
            mockAdAdapter.fetchUsers.mockRejectedValue(
                new AdConnectionException('AD_AUTH_FAILED', 'Auth failed for "BrokenAD"'),
            );

            const result = await service.syncAll();
            expect(result.configsFailed).toBe(1);
            expect(result.details[0].error).toContain('Auth failed');
        });

        it('should handle unexpected errors gracefully', async () => {
            const config = makeConfig();
            mockAdConfigRepo.find.mockResolvedValue([config]);
            mockAdAdapter.fetchUsers.mockRejectedValue(new Error('unexpected LDAP error'));

            const result = await service.syncAll();
            expect(result.configsFailed).toBe(1);
            expect(result.details[0].error).toContain('unexpected LDAP error');
        });

        it('should aggregate counts correctly across mixed success/failure configs', async () => {
            const config1 = makeConfig({ id: 'c1', name: 'Good' });
            const config2 = makeConfig({ id: 'c2', name: 'Bad' });
            const config3 = makeConfig({ id: 'c3', name: 'AlsoGood' });
            mockAdConfigRepo.find.mockResolvedValue([config1, config2, config3]);

            mockAdAdapter.fetchUsers
                .mockResolvedValueOnce([makeAdUser({ externalId: 'u1', username: 'u1' })])
                .mockRejectedValueOnce(new Error('fail'))
                .mockResolvedValueOnce([makeAdUser({ externalId: 'u3', username: 'u3' })]);

            setupUserRepoFind();

            const result = await service.syncAll();
            expect(result.configsProcessed).toBe(2);
            expect(result.configsFailed).toBe(1);
            expect(result.totalCreated).toBe(2);
            expect(result.details).toHaveLength(3);
        });
    });

    describe('sync - case insensitive matching', () => {
        it('should match by adExternalId case-insensitively', async () => {
            const config = makeConfig();
            const localUser = makeLocalUser({ adExternalId: 'JDoe' });
            mockAdConfigRepo.find.mockResolvedValue([config]);
            mockAdAdapter.fetchUsers.mockResolvedValue([
                makeAdUser({ externalId: 'jdoe' }),
            ]);
            setupUserRepoFind([localUser], []);

            const result = await service.syncAll();
            // Should find the user (case-insensitive match)
            expect(result.totalCreated).toBe(0);
        });

        it('should match by username case-insensitively for local users', async () => {
            const config = makeConfig();
            const localUser = makeLocalUser({
                username: 'JDoe',
                syncSource: 'local',
                adSourceId: null,
                adExternalId: null,
            });
            mockAdConfigRepo.find.mockResolvedValue([config]);
            mockAdAdapter.fetchUsers.mockResolvedValue([
                makeAdUser({ externalId: 'jdoe', username: 'jdoe' }),
            ]);
            setupUserRepoFind([], [localUser]);

            const result = await service.syncAll();
            expect(result.totalCreated).toBe(0);
        });
    });
});
