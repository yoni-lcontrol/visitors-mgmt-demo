import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { IntegrationClientConfig } from '../interfaces/integration-client-config.interface';

@Injectable()
export class IntegrationAuthService {
    private readonly logger = new Logger(IntegrationAuthService.name);
    private readonly clients: IntegrationClientConfig[];
    private readonly maxSkewMs: number;

    constructor(private readonly configService: ConfigService) {
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

    isTimestampValid(timestamp: string): boolean {
        const ts = Number(timestamp);
        if (isNaN(ts)) return false;
        const diff = Math.abs(Date.now() - ts);
        return diff <= this.maxSkewMs;
    }

    verifySignature(clientId: string, timestamp: string, rawBody: string, signature: string): boolean {
        const client = this.getClient(clientId);
        if (!client) return false;

        const payload = `${clientId}.${timestamp}.${rawBody}`;
        const expected = crypto
            .createHmac('sha256', client.secret)
            .update(payload)
            .digest('hex');

        const expectedBuf = Buffer.from(expected, 'hex');
        const signatureBuf = Buffer.from(signature, 'hex');

        if (expectedBuf.length !== signatureBuf.length) return false;

        return crypto.timingSafeEqual(expectedBuf, signatureBuf);
    }
}
