import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { EntraIdService } from './entra-id.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { AdConfiguration } from '../settings/entities/ad-configuration.entity';
import { UsersService } from '../users/users.service';
import { createMockRepository } from '../test-utils/mock.factory';
import { AuditService } from '../audit/audit.service';
import { ErrorMessages } from '../common/constants/error-messages.constants';
import * as hashUtil from '../common/utils/hash.util';

jest.mock('jwks-rsa', () => ({
    JwksClient: jest.fn().mockImplementation(() => ({
        getSigningKey: jest.fn().mockResolvedValue({
            getPublicKey: jest.fn().mockReturnValue('mock-key'),
        }),
    })),
}));

describe('AuthService', () => {
    let service: AuthService;
    let mockRefreshTokenRepo: ReturnType<typeof createMockRepository>;
    let mockAdConfigRepo: ReturnType<typeof createMockRepository>;
    let mockUsersService: any;
    let mockJwtService: any;
    let mockConfigService: any;
    let mockAuditService: any;
    let mockEntraIdService: any;

    beforeEach(async () => {
        mockRefreshTokenRepo = createMockRepository();
        mockAdConfigRepo = createMockRepository();
        mockUsersService = {
            findByUsername: jest.fn(),
            findById: jest.fn(),
            findByEmail: jest.fn(),
            findByExternalIdentity: jest.fn(),
            updateLastLogin: jest.fn(),
            updateLastExternalLogin: jest.fn(),
            linkExternalAuth: jest.fn(),
            createExternalUser: jest.fn(),
            createPendingExternalUser: jest.fn(),
        };
        mockJwtService = {
            sign: jest.fn().mockReturnValue('mock-access-token'),
            verify: jest.fn(),
        };
        mockConfigService = {
            get: jest.fn().mockReturnValue(7),
        };
        mockAuditService = {
            log: jest.fn().mockResolvedValue(undefined),
        };
        mockEntraIdService = {
            validateAccessToken: jest.fn(),
            getConfig: jest.fn().mockReturnValue({
                tenantId: 'tid',
                clientId: 'cid',
                authority: 'https://login.microsoftonline.com/tid',
                redirectUri: 'http://localhost:4200',
                postLogoutRedirectUri: 'http://localhost:4200',
                apiAudience: 'api://cid',
                autoProvision: false,
                defaultRole: 'Viewer',
                unknownUserMode: 'deny',
            }),
            isConfigured: jest.fn().mockReturnValue(true),
            extractEmail: jest.fn(),
            extractDisplayName: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                { provide: getRepositoryToken(RefreshToken), useValue: mockRefreshTokenRepo },
                { provide: getRepositoryToken(AdConfiguration), useValue: mockAdConfigRepo },
                { provide: UsersService, useValue: mockUsersService },
                { provide: JwtService, useValue: mockJwtService },
                { provide: ConfigService, useValue: mockConfigService },
                { provide: AuditService, useValue: mockAuditService },
                { provide: EntraIdService, useValue: mockEntraIdService },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
    });

    describe('login', () => {
        const mockUser = {
            id: 'user-1',
            username: 'admin',
            firstName: 'Admin',
            lastName: 'User',
            passwordHash: 'hashed',
            isActive: true,
            sector: { id: 'sector-1', name: 'Operations' },
            role: { id: 'role-admin', name: 'Admin', permissions: [{ key: 'users.read' }] },
        };

        it('should throw UnauthorizedException for unknown username', async () => {
            mockUsersService.findByUsername.mockResolvedValue(null);
            await expect(service.login({ username: 'unknown', password: 'pass123' }))
                .rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException for wrong password', async () => {
            mockUsersService.findByUsername.mockResolvedValue(mockUser);
            jest.spyOn(hashUtil, 'comparePassword').mockResolvedValue(false);
            await expect(service.login({ username: 'admin', password: 'wrong' }))
                .rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException with deactivated message for inactive user', async () => {
            mockUsersService.findByUsername.mockResolvedValue({ ...mockUser, isActive: false });
            jest.spyOn(hashUtil, 'comparePassword').mockResolvedValue(true);
            await expect(service.login({ username: 'admin', password: 'correct' }))
                .rejects.toThrow(new UnauthorizedException(ErrorMessages.USER_INACTIVE));
        });

        it('should return tokens and user info on successful login', async () => {
            mockUsersService.findByUsername.mockResolvedValue(mockUser);
            jest.spyOn(hashUtil, 'comparePassword').mockResolvedValue(true);

            const result = await service.login({ username: 'admin', password: 'correct' });

            expect(result.accessToken).toBe('mock-access-token');
            expect(result.refreshToken).toBeDefined();
            expect(result.user.username).toBe('admin');
            expect(result.user.sector).toEqual({ id: 'sector-1', name: 'Operations' });
            expect(result.user.permissions).toContain('users.read');
            expect(mockUsersService.updateLastLogin).toHaveBeenCalledWith('user-1');
            expect(mockRefreshTokenRepo.save).toHaveBeenCalled();
        });

        it('should merge permissions from multiple roles', async () => {
            const multiRoleUser = {
                ...mockUser,
                roles: [
                    { id: 'r1', name: 'Role1', permissions: [{ key: 'users.read' }, { key: 'users.update' }] },
                    { id: 'r2', name: 'Role2', permissions: [{ key: 'visits.read' }, { key: 'users.read' }] },
                ],
            };

            mockUsersService.findByUsername.mockResolvedValue(multiRoleUser);
            jest.spyOn(hashUtil, 'comparePassword').mockResolvedValue(true);

            const result = await service.login({ username: 'admin', password: 'correct' });

            expect(result.user.roles).toEqual(['Role1', 'Role2']);
            expect(result.user.permissions).toEqual(expect.arrayContaining(['users.read', 'users.update', 'visits.read']));
            expect(result.user.permissions.filter((p) => p === 'users.read')).toHaveLength(1);
        });
    });

    describe('login (AD authentication)', () => {
        const mockAdUser = {
            id: 'user-ad-1',
            username: 'jdoe',
            firstName: 'John',
            lastName: 'Doe',
            passwordHash: null,
            isActive: true,
            syncSource: 'ad',
            adSourceId: 'ad-config-1',
            sector: null,
            role: { id: 'role-1', name: 'Operator', permissions: [{ key: 'visits.read' }] },
        };

        const mockAdConfig = {
            id: 'ad-config-1',
            domain: 'corp.example.com',
            ldapUrl: 'dc01.corp.example.com',
            port: 389,
            useSsl: false,
            baseDn: 'DC=corp,DC=example,DC=com',
            isActive: true,
        };

        it('should throw UnauthorizedException when AD config not found', async () => {
            mockUsersService.findByUsername.mockResolvedValue(mockAdUser);
            mockAdConfigRepo.findOne.mockResolvedValue(null);

            await expect(service.login({ username: 'jdoe', password: 'adpass' }))
                .rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException when LDAP bind fails', async () => {
            mockUsersService.findByUsername.mockResolvedValue(mockAdUser);
            mockAdConfigRepo.findOne.mockResolvedValue(mockAdConfig);

            // Mock ldapts Client — bind will fail
            const mockBind = jest.fn().mockRejectedValue(new Error('Invalid credentials'));
            const mockUnbind = jest.fn().mockResolvedValue(undefined);
            jest.spyOn(require('ldapts'), 'Client').mockImplementation(() => ({
                bind: mockBind,
                unbind: mockUnbind,
            }));

            await expect(service.login({ username: 'jdoe', password: 'wrongpass' }))
                .rejects.toThrow(UnauthorizedException);
        });

        it('should succeed when LDAP bind succeeds for AD user', async () => {
            mockUsersService.findByUsername.mockResolvedValue(mockAdUser);
            mockAdConfigRepo.findOne.mockResolvedValue(mockAdConfig);

            // Mock ldapts Client — bind will succeed
            const mockBind = jest.fn().mockResolvedValue(undefined);
            const mockUnbind = jest.fn().mockResolvedValue(undefined);
            jest.spyOn(require('ldapts'), 'Client').mockImplementation(() => ({
                bind: mockBind,
                unbind: mockUnbind,
            }));

            const result = await service.login({ username: 'jdoe', password: 'adpass' });

            expect(result.accessToken).toBe('mock-access-token');
            expect(result.user.username).toBe('jdoe');
            expect(mockBind).toHaveBeenCalledWith('jdoe@corp.example.com', 'adpass');
            expect(mockUsersService.updateLastLogin).toHaveBeenCalledWith('user-ad-1');
        });

        it('should throw UnauthorizedException for inactive AD user even with valid LDAP bind', async () => {
            mockUsersService.findByUsername.mockResolvedValue({ ...mockAdUser, isActive: false });
            mockAdConfigRepo.findOne.mockResolvedValue(mockAdConfig);

            const mockBind = jest.fn().mockResolvedValue(undefined);
            const mockUnbind = jest.fn().mockResolvedValue(undefined);
            jest.spyOn(require('ldapts'), 'Client').mockImplementation(() => ({
                bind: mockBind,
                unbind: mockUnbind,
            }));

            await expect(service.login({ username: 'jdoe', password: 'adpass' }))
                .rejects.toThrow(new UnauthorizedException(ErrorMessages.USER_INACTIVE));
        });
    });

    describe('logout', () => {
        it('should revoke specific refresh token when provided', async () => {
            await service.logout('user-1', 'some-token');
            expect(mockRefreshTokenRepo.update).toHaveBeenCalledWith(
                expect.objectContaining({ userId: 'user-1' }),
                { isRevoked: true },
            );
        });

        it('should revoke all tokens when no refresh token provided', async () => {
            await service.logout('user-1');
            expect(mockRefreshTokenRepo.update).toHaveBeenCalledWith(
                { userId: 'user-1' },
                { isRevoked: true },
            );
        });
    });

    describe('refreshTokens', () => {
        it('should throw UnauthorizedException for invalid token', async () => {
            mockRefreshTokenRepo.findOne.mockResolvedValue(null);
            await expect(service.refreshTokens('bad-token'))
                .rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException for expired token', async () => {
            mockRefreshTokenRepo.findOne.mockResolvedValue({
                id: 'rt-1',
                userId: 'user-1',
                expiresAt: new Date('2020-01-01'),
                isRevoked: false,
            });
            await expect(service.refreshTokens('expired-token'))
                .rejects.toThrow(UnauthorizedException);
        });

        it('should rotate tokens and return new pair with user data', async () => {
            const future = new Date();
            future.setDate(future.getDate() + 1);
            mockRefreshTokenRepo.findOne.mockResolvedValue({
                id: 'rt-1',
                userId: 'user-1',
                expiresAt: future,
                isRevoked: false,
            });
            const mockUser = {
                id: 'user-1',
                username: 'admin',
                firstName: 'Admin',
                lastName: 'User',
                isActive: true,
                sector: { id: 'sector-1', name: 'Operations' },
                role: { id: 'role-admin', name: 'Admin', permissions: [{ key: 'users.read' }] },
            };
            mockUsersService.findById.mockResolvedValue(mockUser);

            const result = await service.refreshTokens('valid-token');

            expect(result.accessToken).toBe('mock-access-token');
            expect(result.refreshToken).toBeDefined();
            expect(result.user).toBeDefined();
            expect(result.user.username).toBe('admin');
            expect(result.user.sector).toEqual({ id: 'sector-1', name: 'Operations' });
            expect(result.user.permissions).toContain('users.read');
            expect(result.user.roles).toContain('Admin');
            expect(mockRefreshTokenRepo.update).toHaveBeenCalledWith('rt-1', { isRevoked: true });
        });

        it('should reject revoked refresh token', async () => {
            mockRefreshTokenRepo.findOne.mockResolvedValue(null); // already revoked won't match isRevoked: false
            await expect(service.refreshTokens('revoked-token'))
                .rejects.toThrow(UnauthorizedException);
        });

        it('should reject with deactivated message when user is deactivated', async () => {
            const future = new Date();
            future.setDate(future.getDate() + 1);
            mockRefreshTokenRepo.findOne.mockResolvedValue({
                id: 'rt-1',
                userId: 'user-1',
                expiresAt: future,
                isRevoked: false,
            });
            mockUsersService.findById.mockResolvedValue({
                id: 'user-1',
                username: 'admin',
                isActive: false,
                role: null,
            });

            await expect(service.refreshTokens('valid-token'))
                .rejects.toThrow(new UnauthorizedException(ErrorMessages.USER_INACTIVE));
        });

        it('should preserve correct permission set on refresh', async () => {
            const future = new Date();
            future.setDate(future.getDate() + 1);
            mockRefreshTokenRepo.findOne.mockResolvedValue({
                id: 'rt-1',
                userId: 'user-1',
                expiresAt: future,
                isRevoked: false,
            });
            const mockUser = {
                id: 'user-1',
                username: 'admin',
                firstName: 'Admin',
                lastName: 'User',
                isActive: true,
                role: { id: 'role-admin', name: 'Admin', permissions: [{ key: 'users.read' }, { key: 'users.create' }] },
            };
            mockUsersService.findById.mockResolvedValue(mockUser);

            const result = await service.refreshTokens('valid-token');

            expect(result.user.permissions).toContain('users.read');
            expect(result.user.permissions).toContain('users.create');
            expect(result.user.permissions).toHaveLength(2);
        });

        it('should reflect updated permissions after admin changes role between login and refresh', async () => {
            const future = new Date();
            future.setDate(future.getDate() + 1);

            // --- Step 1: User logs in with Admin role (has users.read, users.create) ---
            mockUsersService.findByUsername.mockResolvedValue({
                id: 'user-1',
                username: 'testuser',
                firstName: 'Test',
                lastName: 'User',
                passwordHash: 'hashed',
                isActive: true,
                role: { id: 'role-admin', name: 'Admin', permissions: [{ key: 'users.read' }, { key: 'users.create' }] },
            });
            jest.spyOn(hashUtil, 'comparePassword').mockResolvedValue(true);

            const loginResult = await service.login({ username: 'testuser', password: 'correct' });
            expect(loginResult.user.permissions).toContain('users.read');
            expect(loginResult.user.permissions).toContain('users.create');
            expect(loginResult.user.roles).toContain('Admin');

            // --- Step 2: Admin changes the user's role to Operator (visits.read, visits.create only) ---
            // On next refresh, findById returns the updated user with new role/permissions
            mockRefreshTokenRepo.findOne.mockResolvedValue({
                id: 'rt-1',
                userId: 'user-1',
                expiresAt: future,
                isRevoked: false,
            });
            mockUsersService.findById.mockResolvedValue({
                id: 'user-1',
                username: 'testuser',
                firstName: 'Test',
                lastName: 'User',
                isActive: true,
                role: { id: 'role-operator', name: 'Operator', permissions: [{ key: 'visits.read' }, { key: 'visits.create' }] },
            });

            // --- Step 3: User's token refresh picks up the new permissions ---
            const refreshResult = await service.refreshTokens('valid-token');

            // New permissions are present
            expect(refreshResult.user.permissions).toContain('visits.read');
            expect(refreshResult.user.permissions).toContain('visits.create');
            // Old permissions are gone
            expect(refreshResult.user.permissions).not.toContain('users.read');
            expect(refreshResult.user.permissions).not.toContain('users.create');
            // Role changed
            expect(refreshResult.user.roles).toContain('Operator');
            expect(refreshResult.user.roles).not.toContain('Admin');
        });

        it('should reflect updated permissions after admin modifies permissions within the same role', async () => {
            const future = new Date();
            future.setDate(future.getDate() + 1);

            // --- Step 1: User logs in with Admin role that has users.read, users.create, users.update ---
            mockUsersService.findByUsername.mockResolvedValue({
                id: 'user-1',
                username: 'testuser',
                firstName: 'Test',
                lastName: 'User',
                passwordHash: 'hashed',
                isActive: true,
                role: { id: 'role-admin', name: 'Admin', permissions: [{ key: 'users.read' }, { key: 'users.create' }, { key: 'users.update' }] },
            });
            jest.spyOn(hashUtil, 'comparePassword').mockResolvedValue(true);

            const loginResult = await service.login({ username: 'testuser', password: 'correct' });
            expect(loginResult.user.permissions).toContain('users.read');
            expect(loginResult.user.permissions).toContain('users.create');
            expect(loginResult.user.permissions).toContain('users.update');

            // --- Step 2: Admin removes users.update from the Admin role and adds visits.read ---
            // Same role name, same role id — just different permissions
            mockRefreshTokenRepo.findOne.mockResolvedValue({
                id: 'rt-1',
                userId: 'user-1',
                expiresAt: future,
                isRevoked: false,
            });
            mockUsersService.findById.mockResolvedValue({
                id: 'user-1',
                username: 'testuser',
                firstName: 'Test',
                lastName: 'User',
                isActive: true,
                role: { id: 'role-admin', name: 'Admin', permissions: [{ key: 'users.read' }, { key: 'users.create' }, { key: 'visits.read' }] },
            });

            // --- Step 3: User's token refresh picks up the modified role permissions ---
            const refreshResult = await service.refreshTokens('valid-token');

            // Role is the same
            expect(refreshResult.user.roles).toContain('Admin');
            // Kept permissions still present
            expect(refreshResult.user.permissions).toContain('users.read');
            expect(refreshResult.user.permissions).toContain('users.create');
            // Newly added permission is present
            expect(refreshResult.user.permissions).toContain('visits.read');
            // Removed permission is gone
            expect(refreshResult.user.permissions).not.toContain('users.update');
        });
    });

    describe('getCurrentUser', () => {
        it('should throw UnauthorizedException when user not found', async () => {
            mockUsersService.findById.mockRejectedValue(new UnauthorizedException());
            await expect(service.getCurrentUser('nonexistent'))
                .rejects.toThrow(UnauthorizedException);
        });

        it('should return user with permissions', async () => {
            const mockUser = {
                id: 'user-1',
                username: 'admin',
                firstName: 'Admin',
                lastName: 'User',
                role: { id: 'role-admin', name: 'Admin', permissions: [{ key: 'users.read' }, { key: 'users.create' }] },
            };
            mockUsersService.findById.mockResolvedValue(mockUser);

            const result = await service.getCurrentUser('user-1');

            expect(result.username).toBe('admin');
            expect(result.permissions).toContain('users.read');
            expect(result.permissions).toContain('users.create');
        });
    });

    describe('loginWithEntra', () => {
        const mockClaims = {
            oid: 'entra-oid-123',
            upn: 'john@domain.com',
            email: 'john@domain.com',
            given_name: 'John',
            family_name: 'Doe',
            name: 'John Doe',
            tid: 'test-tenant',
        };

        const mockUser = {
            id: 'user-1',
            username: 'john',
            firstName: 'John',
            lastName: 'Doe',
            isActive: true,
            role: { id: 'role-viewer', name: 'Viewer', permissions: [{ key: 'users.read' }] },
        };

        beforeEach(() => {
            mockEntraIdService.validateAccessToken.mockResolvedValue(mockClaims);
            mockEntraIdService.extractEmail.mockReturnValue('john@domain.com');
            mockEntraIdService.extractDisplayName.mockReturnValue({ firstName: 'John', lastName: 'Doe' });
        });

        it('should authenticate user found by external identity', async () => {
            mockUsersService.findByExternalIdentity.mockResolvedValue(mockUser);

            const result = await service.loginWithEntra('valid-token');

            expect(result.accessToken).toBe('mock-access-token');
            expect(result.user.username).toBe('john');
            expect(result.user.permissions).toContain('users.read');
            expect(mockUsersService.updateLastExternalLogin).toHaveBeenCalledWith(
                'user-1',
                expect.objectContaining({
                    displayName: 'John Doe',
                    email: 'john@domain.com',
                }),
            );
        });

        it('should fallback to email lookup and link external auth', async () => {
            mockUsersService.findByExternalIdentity.mockResolvedValue(null);
            mockUsersService.findByEmail.mockResolvedValue(mockUser);

            const result = await service.loginWithEntra('valid-token');

            expect(result.user.username).toBe('john');
            expect(mockUsersService.linkExternalAuth).toHaveBeenCalledWith(
                'user-1',
                expect.objectContaining({
                    provider: 'entra',
                    externalId: 'entra-oid-123',
                    tenantId: 'test-tenant',
                }),
            );
        });

        it('should auto-provision when mode is autoProvision and user not found', async () => {
            mockUsersService.findByExternalIdentity.mockResolvedValue(null);
            mockUsersService.findByEmail.mockResolvedValue(null);
            mockEntraIdService.getConfig.mockReturnValue({
                tenantId: 'tid',
                clientId: 'cid',
                authority: 'https://login.microsoftonline.com/tid',
                redirectUri: '',
                postLogoutRedirectUri: '',
                apiAudience: 'api://cid',
                autoProvision: true,
                defaultRole: 'Viewer',
                unknownUserMode: 'autoProvision',
            });
            mockUsersService.createExternalUser.mockResolvedValue(mockUser);

            const result = await service.loginWithEntra('valid-token');

            expect(mockUsersService.createExternalUser).toHaveBeenCalledWith(
                expect.objectContaining({
                    externalAuthProvider: 'entra',
                    externalAuthId: 'entra-oid-123',
                    externalTenantId: 'test-tenant',
                    roleNames: ['Viewer'],
                }),
            );
            expect(result.user.username).toBe('john');
        });

        it('should create pending user when mode is pending and user not found', async () => {
            mockUsersService.findByExternalIdentity.mockResolvedValue(null);
            mockUsersService.findByEmail.mockResolvedValue(null);
            mockEntraIdService.getConfig.mockReturnValue({
                tenantId: 'tid',
                clientId: 'cid',
                authority: 'https://login.microsoftonline.com/tid',
                redirectUri: '',
                postLogoutRedirectUri: '',
                apiAudience: 'api://cid',
                autoProvision: false,
                defaultRole: 'Viewer',
                unknownUserMode: 'pending',
            });

            await expect(service.loginWithEntra('valid-token'))
                .rejects.toThrow('pending administrator approval');

            expect(mockUsersService.createPendingExternalUser).toHaveBeenCalled();
        });

        it('should throw when user not found and mode is deny', async () => {
            mockUsersService.findByExternalIdentity.mockResolvedValue(null);
            mockUsersService.findByEmail.mockResolvedValue(null);

            await expect(service.loginWithEntra('valid-token'))
                .rejects.toThrow('No matching local account found');
        });

        it('should throw when user is deactivated', async () => {
            mockUsersService.findByExternalIdentity.mockResolvedValue({
                ...mockUser,
                isActive: false,
            });

            await expect(service.loginWithEntra('valid-token'))
                .rejects.toThrow(new UnauthorizedException(ErrorMessages.USER_INACTIVE));
        });

        it('should throw when token validation fails', async () => {
            mockEntraIdService.validateAccessToken.mockRejectedValue(
                new UnauthorizedException('Invalid or expired Entra access token'),
            );

            await expect(service.loginWithEntra('bad-token'))
                .rejects.toThrow(UnauthorizedException);
        });

        it('should set refresh token cookie data', async () => {
            mockUsersService.findByExternalIdentity.mockResolvedValue(mockUser);

            const result = await service.loginWithEntra('valid-token');

            expect(result.refreshToken).toBeDefined();
            expect(mockRefreshTokenRepo.save).toHaveBeenCalled();
        });

        it('should log audit event for Entra login', async () => {
            mockUsersService.findByExternalIdentity.mockResolvedValue(mockUser);

            await service.loginWithEntra('valid-token', 'Mozilla/5.0', '127.0.0.1');

            expect(mockAuditService.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'ENTRA_LOGIN',
                    module: 'auth',
                    userId: 'user-1',
                }),
            );
        });
    });
});
