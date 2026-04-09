import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { DeviceAgent } from '../entities/device-agent.entity';
import { IntegrationClientConfig } from '../../integrations/common/interfaces/integration-client-config.interface';

@Injectable()
export class AgentHmacAuthService {
    private readonly logger = new Logger(AgentHmacAuthService.name);
    private readonly clients: IntegrationClientConfig[];
    private readonly maxSkewMs: number;

    constructor(
        private readonly configService: ConfigService,
        @InjectRepository(DeviceAgent)
        private readonly deviceAgentRepo: Repository<DeviceAgent>,
    ) {
        const clientsJson = this.configService.get<string>('INTEGRATIONS_CLIENTS_JSON', '[]');
        try {
            this.clients = JSON.parse(clientsJson);
        } catch {
            this.logger.error('Failed to parse INTEGRATIONS_CLIENTS_JSON');
            this.clients = [];
        }
        this.maxSkewMs = this.configService.get<number>('INTEGRATIONS_HMAC_MAX_SKEW_MS', 300_000);
    }

    getClient(clientId: string): IntegrationClientConfig | undefined {
        return this.clients.find((c) => c.clientId === clientId && c.enabled);
    }

    isTimestampValid(timestamp: number): boolean {
        if (isNaN(timestamp)) return false;
        const diff = Math.abs(Date.now() - timestamp);
        return diff <= this.maxSkewMs;
    }

    verifySignature(clientId: string, timestamp: number, signature: string): boolean {
        const client = this.getClient(clientId);
        if (!client) return false;
        return this.verifySignatureWithSecret(clientId, timestamp, signature, client.secret);
    }

    verifySignatureWithSecret(clientId: string, timestamp: number, signature: string, secret: string): boolean {
        const payload = `${clientId}.${timestamp}`;
        const expected = crypto
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex');

        const expectedBuf = Buffer.from(expected, 'hex');
        const signatureBuf = Buffer.from(signature, 'hex');

        if (expectedBuf.length !== signatureBuf.length) return false;

        return crypto.timingSafeEqual(expectedBuf, signatureBuf);
    }

    async validateAgentRegistration(
        clientId: string,
        timestamp: number,
        signature: string,
    ): Promise<{ valid: true; client: IntegrationClientConfig } | { valid: true; deviceAgent: DeviceAgent } | { valid: false; reason: string }> {
        // Try config-based client first (INTEGRATIONS_CLIENTS_JSON)
        const client = this.getClient(clientId);

        if (client) {
            if (!this.isTimestampValid(timestamp)) {
                return { valid: false, reason: 'Request timestamp is expired or invalid' };
            }

            if (!this.verifySignatureWithSecret(clientId, timestamp, signature, client.secret)) {
                return { valid: false, reason: 'Invalid HMAC signature' };
            }

            // Check agent is enabled in DB
            const agent = await this.deviceAgentRepo.findOne({
                where: { clientId, isEnabled: true, isActive: true },
            });
            if (!agent) {
                return { valid: false, reason: 'Agent not registered or disabled' };
            }

            return { valid: true, client };
        }

        // Fall back to DB-enrolled agent
        const deviceAgent = await this.deviceAgentRepo.findOne({
            where: { clientId, isEnabled: true, isActive: true },
        });
        if (!deviceAgent || !deviceAgent.clientSecret) {
            return { valid: false, reason: 'Unknown or disabled integration client' };
        }

        if (!this.isTimestampValid(timestamp)) {
            return { valid: false, reason: 'Request timestamp is expired or invalid' };
        }

        if (!this.verifySignatureWithSecret(clientId, timestamp, signature, deviceAgent.clientSecret)) {
            return { valid: false, reason: 'Invalid HMAC signature' };
        }

        return { valid: true, deviceAgent };
    }

    async findDeviceAgent(clientId: string): Promise<DeviceAgent | null> {
        return this.deviceAgentRepo.findOne({
            where: { clientId, isEnabled: true, isActive: true },
            relations: ['workstation'],
        });
    }
}
