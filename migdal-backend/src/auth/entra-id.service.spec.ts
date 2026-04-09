import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { EntraIdService, EntraTokenClaims } from './entra-id.service';
import * as jwt from 'jsonwebtoken';

// Mock jsonwebtoken
jest.mock('jsonwebtoken');
// Mock jwks-rsa
jest.mock('jwks-rsa', () => ({
    JwksClient: jest.fn().mockImplementation(() => ({
        getSigningKey: jest.fn().mockResolvedValue({
            getPublicKey: jest.fn().mockReturnValue('mock-public-key'),
        }),
    })),
}));

describe('EntraIdService', () => {
    let service: EntraIdService;
    let mockConfigService: Record<string, jest.Mock>;

    const validConfig = {
        ENTRA_TENANT_ID: 'test-tenant-id',
        ENTRA_CLIENT_ID: 'test-client-id',
        ENTRA_REDIRECT_URI: 'http://localhost:4200',
        ENTRA_AUTO_PROVISION: 'false',
        ENTRA_DEFAULT_ROLE: 'Viewer',
    };

    beforeEach(async () => {
        mockConfigService = {
            get: jest.fn((key: string, defaultValue?: string) => {
                return (validConfig as Record<string, string>)[key] ?? defaultValue ?? '';
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EntraIdService,
                { provide: ConfigService, useValue: mockConfigService },
            ],
        }).compile();

        service = module.get<EntraIdService>(EntraIdService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getConfig', () => {
        it('should return configuration from environment', () => {
            const config = service.getConfig();
            expect(config.tenantId).toBe('test-tenant-id');
            expect(config.clientId).toBe('test-client-id');
            expect(config.redirectUri).toBe('http://localhost:4200');
            expect(config.autoProvision).toBe(false);
            expect(config.defaultRole).toBe('Viewer');
        });

        it('should return autoProvision true when configured', () => {
            mockConfigService.get.mockImplementation((key: string, defaultValue?: string) => {
                if (key === 'ENTRA_AUTO_PROVISION') return 'true';
                return (validConfig as Record<string, string>)[key] ?? defaultValue ?? '';
            });
            const config = service.getConfig();
            expect(config.autoProvision).toBe(true);
        });
    });

    describe('isConfigured', () => {
        it('should return true when tenant and client IDs are set', () => {
            expect(service.isConfigured()).toBe(true);
        });

        it('should return false when tenant ID is missing', () => {
            mockConfigService.get.mockImplementation((key: string, defaultValue?: string) => {
                if (key === 'ENTRA_TENANT_ID') return '';
                return (validConfig as Record<string, string>)[key] ?? defaultValue ?? '';
            });
            expect(service.isConfigured()).toBe(false);
        });

        it('should return false when client ID is missing', () => {
            mockConfigService.get.mockImplementation((key: string, defaultValue?: string) => {
                if (key === 'ENTRA_CLIENT_ID') return '';
                return (validConfig as Record<string, string>)[key] ?? defaultValue ?? '';
            });
            expect(service.isConfigured()).toBe(false);
        });
    });

    describe('validateIdToken', () => {
        const mockClaims = {
            oid: 'user-oid-123',
            upn: 'user@domain.com',
            email: 'user@domain.com',
            given_name: 'John',
            family_name: 'Doe',
            name: 'John Doe',
            tid: 'test-tenant-id',
        };

        it('should throw when Entra is not configured', async () => {
            mockConfigService.get.mockImplementation((key: string, defaultValue?: string) => {
                if (key === 'ENTRA_TENANT_ID') return '';
                return defaultValue ?? '';
            });

            await expect(service.validateIdToken('some-token'))
                .rejects.toThrow(UnauthorizedException);
        });

        it('should throw for invalid token format (no header)', async () => {
            (jwt.decode as jest.Mock).mockReturnValue(null);

            await expect(service.validateIdToken('bad-token'))
                .rejects.toThrow('Invalid ID token format');
        });

        it('should throw when token has no kid in header', async () => {
            (jwt.decode as jest.Mock).mockReturnValue({
                header: {},
                payload: mockClaims,
            });

            await expect(service.validateIdToken('no-kid-token'))
                .rejects.toThrow('Invalid ID token format');
        });

        it('should throw when oid claim is missing', async () => {
            (jwt.decode as jest.Mock).mockReturnValue({
                header: { kid: 'test-kid', alg: 'RS256' },
                payload: { ...mockClaims, oid: undefined },
            });
            (jwt.verify as jest.Mock).mockReturnValue({ tid: 'test-tenant-id' });

            await expect(service.validateIdToken('no-oid-token'))
                .rejects.toThrow('Missing oid claim');
        });

        it('should return claims for a valid token', async () => {
            (jwt.decode as jest.Mock).mockReturnValue({
                header: { kid: 'test-kid', alg: 'RS256' },
                payload: mockClaims,
            });
            (jwt.verify as jest.Mock).mockReturnValue(mockClaims);

            const result = await service.validateIdToken('valid-token');

            expect(result.oid).toBe('user-oid-123');
            expect(result.email).toBe('user@domain.com');
            expect(result.given_name).toBe('John');
            expect(result.family_name).toBe('Doe');
        });

        it('should throw for expired token', async () => {
            (jwt.decode as jest.Mock).mockReturnValue({
                header: { kid: 'test-kid', alg: 'RS256' },
                payload: mockClaims,
            });
            (jwt.verify as jest.Mock).mockImplementation(() => {
                throw new jwt.TokenExpiredError('jwt expired', new Date());
            });

            await expect(service.validateIdToken('expired-token'))
                .rejects.toThrow('Invalid or expired ID token');
        });

        it('should throw for invalid audience', async () => {
            (jwt.decode as jest.Mock).mockReturnValue({
                header: { kid: 'test-kid', alg: 'RS256' },
                payload: mockClaims,
            });
            (jwt.verify as jest.Mock).mockImplementation(() => {
                throw new jwt.JsonWebTokenError('jwt audience invalid');
            });

            await expect(service.validateIdToken('wrong-audience-token'))
                .rejects.toThrow('Invalid or expired ID token');
        });
    });

    describe('extractEmail', () => {
        it('should return email when available', () => {
            const claims: EntraTokenClaims = {
                oid: '123', tid: 'tid', email: 'user@test.com',
            };
            expect(service.extractEmail(claims)).toBe('user@test.com');
        });

        it('should fall back to UPN', () => {
            const claims: EntraTokenClaims = {
                oid: '123', tid: 'tid', upn: 'user@domain.com',
            };
            expect(service.extractEmail(claims)).toBe('user@domain.com');
        });

        it('should fall back to preferred_username', () => {
            const claims: EntraTokenClaims = {
                oid: '123', tid: 'tid', preferred_username: 'pref@test.com',
            };
            expect(service.extractEmail(claims)).toBe('pref@test.com');
        });

        it('should return null when no email-like claim exists', () => {
            const claims: EntraTokenClaims = { oid: '123', tid: 'tid' };
            expect(service.extractEmail(claims)).toBeNull();
        });
    });

    describe('extractDisplayName', () => {
        it('should use given_name and family_name when available', () => {
            const claims: EntraTokenClaims = {
                oid: '123', tid: 'tid',
                given_name: 'John', family_name: 'Doe',
            };
            expect(service.extractDisplayName(claims)).toEqual({
                firstName: 'John', lastName: 'Doe',
            });
        });

        it('should split name if given/family not available', () => {
            const claims: EntraTokenClaims = {
                oid: '123', tid: 'tid', name: 'Jane Smith',
            };
            expect(service.extractDisplayName(claims)).toEqual({
                firstName: 'Jane', lastName: 'Smith',
            });
        });

        it('should handle single-word name', () => {
            const claims: EntraTokenClaims = {
                oid: '123', tid: 'tid', name: 'Madonna',
            };
            expect(service.extractDisplayName(claims)).toEqual({
                firstName: 'Madonna', lastName: 'User',
            });
        });

        it('should return defaults when no name claims exist', () => {
            const claims: EntraTokenClaims = { oid: '123', tid: 'tid' };
            expect(service.extractDisplayName(claims)).toEqual({
                firstName: 'Unknown', lastName: 'User',
            });
        });

        it('should handle multi-part last names', () => {
            const claims: EntraTokenClaims = {
                oid: '123', tid: 'tid', name: 'Mary Jane Watson',
            };
            expect(service.extractDisplayName(claims)).toEqual({
                firstName: 'Mary', lastName: 'Jane Watson',
            });
        });
    });
});
