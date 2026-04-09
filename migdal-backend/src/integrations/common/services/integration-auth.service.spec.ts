import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { IntegrationAuthService } from './integration-auth.service';
import { IntegrationProvider } from '../enums/integration-provider.enum';

describe('IntegrationAuthService', () => {
    let service: IntegrationAuthService;
    let configService: Partial<ConfigService>;

    const mockClients = [
        {
            clientId: 'client-1',
            provider: IntegrationProvider.AccessControl,
            secret: 'test-secret-123',
            enabled: true,
        },
        {
            clientId: 'client-disabled',
            provider: IntegrationProvider.Scanner,
            secret: 'disabled-secret',
            enabled: false,
        },
    ];

    beforeEach(async () => {
        configService = {
            get: jest.fn((key: string, defaultValue?: any) => {
                if (key === 'INTEGRATIONS_CLIENTS_JSON') return JSON.stringify(mockClients);
                if (key === 'INTEGRATIONS_HMAC_MAX_SKEW_MS') return 300_000;
                return defaultValue;
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                IntegrationAuthService,
                { provide: ConfigService, useValue: configService },
            ],
        }).compile();

        service = module.get<IntegrationAuthService>(IntegrationAuthService);
    });

    describe('getClient', () => {
        it('should return an enabled client by clientId', () => {
            const client = service.getClient('client-1');
            expect(client).toBeDefined();
            expect(client!.clientId).toBe('client-1');
            expect(client!.provider).toBe(IntegrationProvider.AccessControl);
        });

        it('should return undefined for a disabled client', () => {
            const client = service.getClient('client-disabled');
            expect(client).toBeUndefined();
        });

        it('should return undefined for an unknown clientId', () => {
            const client = service.getClient('unknown');
            expect(client).toBeUndefined();
        });
    });

    describe('isTimestampValid', () => {
        it('should return true for a current timestamp', () => {
            const ts = Date.now().toString();
            expect(service.isTimestampValid(ts)).toBe(true);
        });

        it('should return false for an expired timestamp', () => {
            const ts = (Date.now() - 400_000).toString();
            expect(service.isTimestampValid(ts)).toBe(false);
        });

        it('should return false for a non-numeric timestamp', () => {
            expect(service.isTimestampValid('not-a-number')).toBe(false);
        });

        it('should return true for a timestamp within skew window', () => {
            const ts = (Date.now() - 200_000).toString();
            expect(service.isTimestampValid(ts)).toBe(true);
        });
    });

    describe('verifySignature', () => {
        it('should return true for a valid HMAC signature', () => {
            const clientId = 'client-1';
            const timestamp = Date.now().toString();
            const rawBody = '{"eventId":"e1","eventType":"access_granted","occurredAt":"2024-01-01T00:00:00Z"}';
            const payload = `${clientId}.${timestamp}.${rawBody}`;
            const signature = crypto.createHmac('sha256', 'test-secret-123').update(payload).digest('hex');

            expect(service.verifySignature(clientId, timestamp, rawBody, signature)).toBe(true);
        });

        it('should return false for an invalid signature', () => {
            const clientId = 'client-1';
            const timestamp = Date.now().toString();
            const rawBody = '{"test":"data"}';
            const signature = 'invalid-signature-hex'.padEnd(64, '0');

            expect(service.verifySignature(clientId, timestamp, rawBody, signature)).toBe(false);
        });

        it('should return false for an unknown client', () => {
            expect(service.verifySignature('unknown', '123', '{}', 'a'.repeat(64))).toBe(false);
        });

        it('should return false for a disabled client', () => {
            expect(service.verifySignature('client-disabled', '123', '{}', 'a'.repeat(64))).toBe(false);
        });
    });

    describe('constructor', () => {
        it('should default to empty clients when JSON is invalid', async () => {
            const badConfigService: Partial<ConfigService> = {
                get: jest.fn((key: string, defaultValue?: any) => {
                    if (key === 'INTEGRATIONS_CLIENTS_JSON') return 'invalid-json';
                    if (key === 'INTEGRATIONS_HMAC_MAX_SKEW_MS') return 300_000;
                    return defaultValue;
                }),
            };

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    IntegrationAuthService,
                    { provide: ConfigService, useValue: badConfigService },
                ],
            }).compile();

            const svc = module.get<IntegrationAuthService>(IntegrationAuthService);
            expect(svc.getClient('client-1')).toBeUndefined();
        });
    });
});
