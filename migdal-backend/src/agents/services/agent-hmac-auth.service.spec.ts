import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { AgentHmacAuthService } from './agent-hmac-auth.service';
import { DeviceAgent } from '../entities/device-agent.entity';
import { createMockRepository } from '../../test-utils/mock.factory';

const TEST_SECRET = 'test-secret-256-bit-key-for-hmac';
const TEST_CLIENT_CONFIG = JSON.stringify([
    { clientId: 'printer-agent-1', provider: 'printer', secret: TEST_SECRET, enabled: true },
    { clientId: 'scanner-agent-1', provider: 'scanner', secret: TEST_SECRET, enabled: true },
    { clientId: 'disabled-agent', provider: 'printer', secret: TEST_SECRET, enabled: false },
]);

function computeSignature(clientId: string, timestamp: number, secret: string): string {
    return crypto.createHmac('sha256', secret).update(`${clientId}.${timestamp}`).digest('hex');
}

describe('AgentHmacAuthService', () => {
    let service: AgentHmacAuthService;
    let mockRepo: ReturnType<typeof createMockRepository>;

    beforeEach(async () => {
        mockRepo = createMockRepository();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AgentHmacAuthService,
                { provide: getRepositoryToken(DeviceAgent), useValue: mockRepo },
                {
                    provide: ConfigService,
                    useValue: {
                        get: (key: string, defaultValue?: unknown) => {
                            if (key === 'INTEGRATIONS_CLIENTS_JSON') return TEST_CLIENT_CONFIG;
                            if (key === 'INTEGRATIONS_HMAC_MAX_SKEW_MS') return 300_000;
                            return defaultValue;
                        },
                    },
                },
            ],
        }).compile();

        service = module.get<AgentHmacAuthService>(AgentHmacAuthService);
    });

    describe('getClient', () => {
        it('should return client config for valid clientId', () => {
            const client = service.getClient('printer-agent-1');
            expect(client).toBeDefined();
            expect(client?.clientId).toBe('printer-agent-1');
            expect(client?.provider).toBe('printer');
        });

        it('should return undefined for unknown clientId', () => {
            expect(service.getClient('unknown')).toBeUndefined();
        });

        it('should return undefined for disabled client', () => {
            expect(service.getClient('disabled-agent')).toBeUndefined();
        });
    });

    describe('isTimestampValid', () => {
        it('should return true for current timestamp', () => {
            expect(service.isTimestampValid(Date.now())).toBe(true);
        });

        it('should return true for timestamp within skew window', () => {
            expect(service.isTimestampValid(Date.now() - 60_000)).toBe(true);
        });

        it('should return false for timestamp outside skew window', () => {
            expect(service.isTimestampValid(Date.now() - 600_000)).toBe(false);
        });

        it('should return false for NaN', () => {
            expect(service.isTimestampValid(NaN)).toBe(false);
        });
    });

    describe('verifySignature', () => {
        it('should return true for valid signature', () => {
            const timestamp = Date.now();
            const signature = computeSignature('printer-agent-1', timestamp, TEST_SECRET);
            expect(service.verifySignature('printer-agent-1', timestamp, signature)).toBe(true);
        });

        it('should return false for invalid signature', () => {
            expect(service.verifySignature('printer-agent-1', Date.now(), 'bad-signature')).toBe(false);
        });

        it('should return false for unknown client', () => {
            const timestamp = Date.now();
            const signature = computeSignature('unknown', timestamp, TEST_SECRET);
            expect(service.verifySignature('unknown', timestamp, signature)).toBe(false);
        });

        it('should return false for tampered timestamp', () => {
            const timestamp = Date.now();
            const signature = computeSignature('printer-agent-1', timestamp, TEST_SECRET);
            expect(service.verifySignature('printer-agent-1', timestamp + 1, signature)).toBe(false);
        });
    });

    describe('validateAgentRegistration', () => {
        it('should return valid for proper registration', async () => {
            const timestamp = Date.now();
            const signature = computeSignature('printer-agent-1', timestamp, TEST_SECRET);
            mockRepo.findOne.mockResolvedValue({ id: 'agent-1', clientId: 'printer-agent-1', isEnabled: true, isActive: true });

            const result = await service.validateAgentRegistration('printer-agent-1', timestamp, signature);
            expect(result.valid).toBe(true);
        });

        it('should reject unknown client', async () => {
            mockRepo.findOne.mockResolvedValue(null);
            const result = await service.validateAgentRegistration('unknown', Date.now(), 'any');
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.reason).toContain('Unknown or disabled');
            }
        });

        it('should reject expired timestamp', async () => {
            const timestamp = Date.now() - 600_000;
            const signature = computeSignature('printer-agent-1', timestamp, TEST_SECRET);

            const result = await service.validateAgentRegistration('printer-agent-1', timestamp, signature);
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.reason).toContain('timestamp');
            }
        });

        it('should reject invalid signature', async () => {
            const result = await service.validateAgentRegistration('printer-agent-1', Date.now(), 'invalid');
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.reason).toContain('signature');
            }
        });

        it('should reject disabled agent in DB', async () => {
            const timestamp = Date.now();
            const signature = computeSignature('printer-agent-1', timestamp, TEST_SECRET);
            mockRepo.findOne.mockResolvedValue(null);

            const result = await service.validateAgentRegistration('printer-agent-1', timestamp, signature);
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.reason).toContain('not registered or disabled');
            }
        });
    });

    describe('validateAgentRegistration (DB-enrolled agents)', () => {
        const DB_AGENT_SECRET = 'db-enrolled-agent-secret-key-for-hmac';
        const DB_CLIENT_ID = 'agent-printer-abc123';

        it('should return valid for DB-enrolled agent with correct HMAC', async () => {
            const timestamp = Date.now();
            const signature = computeSignature(DB_CLIENT_ID, timestamp, DB_AGENT_SECRET);
            mockRepo.findOne.mockResolvedValue({
                id: 'agent-db-1',
                clientId: DB_CLIENT_ID,
                clientSecret: DB_AGENT_SECRET,
                isEnabled: true,
                isActive: true,
            });

            const result = await service.validateAgentRegistration(DB_CLIENT_ID, timestamp, signature);
            expect(result.valid).toBe(true);
            if (result.valid && 'deviceAgent' in result) {
                expect(result.deviceAgent.clientId).toBe(DB_CLIENT_ID);
            }
        });

        it('should reject DB-enrolled agent with invalid HMAC', async () => {
            const timestamp = Date.now();
            mockRepo.findOne.mockResolvedValue({
                id: 'agent-db-1',
                clientId: DB_CLIENT_ID,
                clientSecret: DB_AGENT_SECRET,
                isEnabled: true,
                isActive: true,
            });

            const result = await service.validateAgentRegistration(DB_CLIENT_ID, timestamp, 'bad-signature');
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.reason).toContain('signature');
            }
        });

        it('should reject DB-enrolled agent with expired timestamp', async () => {
            const timestamp = Date.now() - 600_000;
            const signature = computeSignature(DB_CLIENT_ID, timestamp, DB_AGENT_SECRET);
            mockRepo.findOne.mockResolvedValue({
                id: 'agent-db-1',
                clientId: DB_CLIENT_ID,
                clientSecret: DB_AGENT_SECRET,
                isEnabled: true,
                isActive: true,
            });

            const result = await service.validateAgentRegistration(DB_CLIENT_ID, timestamp, signature);
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.reason).toContain('timestamp');
            }
        });

        it('should reject DB-enrolled agent without clientSecret stored', async () => {
            mockRepo.findOne.mockResolvedValue({
                id: 'agent-db-1',
                clientId: DB_CLIENT_ID,
                clientSecret: null,
                isEnabled: true,
                isActive: true,
            });

            const result = await service.validateAgentRegistration(DB_CLIENT_ID, Date.now(), 'any');
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.reason).toContain('Unknown or disabled');
            }
        });

        it('should reject disabled DB-enrolled agent', async () => {
            mockRepo.findOne.mockResolvedValue(null);

            const result = await service.validateAgentRegistration(DB_CLIENT_ID, Date.now(), 'any');
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.reason).toContain('Unknown or disabled');
            }
        });
    });
});
