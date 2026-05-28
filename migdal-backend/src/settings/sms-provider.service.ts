import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SmsSendRequest {
    to: string;
    message: string;
}

export interface SmsSendResult {
    success: boolean;
    to: string;
    error?: string;
}

/**
 * Adapter for the remote SMS provider API.
 * Isolated behind this service so the provider can be swapped easily.
 */
@Injectable()
export class SmsProviderService {
    private readonly logger = new Logger(SmsProviderService.name);
    private readonly baseUrl: string;
    private readonly apiKey: string;
    private readonly timeout: number;
    private readonly enabled: boolean;

    constructor(private readonly config: ConfigService) {
        this.baseUrl = this.config.get<string>('SMS_REMOTE_URL', '');
        this.apiKey = this.config.get<string>('SMS_PROVIDER_API_KEY', '');
        this.timeout = this.config.get<number>('SMS_PROVIDER_TIMEOUT', 10000);
        this.enabled = !!this.baseUrl;
    }

    isConfigured(): boolean {
        return this.enabled && !!this.baseUrl;
    }

    async send(request: SmsSendRequest): Promise<SmsSendResult> {
        if (!this.isConfigured()) {
            this.logger.warn('SMS provider not configured, skipping send');
            return { success: false, to: request.to, error: 'SMS provider not configured' };
        }

        if (!this.isValidPhoneNumber(request.to)) {
            this.logger.warn(`Invalid phone number: ${request.to}`);
            return { success: false, to: request.to, error: 'Invalid phone number' };
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            const response = await fetch(`${this.baseUrl}/send-sms`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to: request.to,
                    text: request.message,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                this.logger.error(`SMS send failed for ${request.to}: ${response.status} ${errorText}`);
                return { success: false, to: request.to, error: `HTTP ${response.status}` };
            }

            this.logger.log(`SMS sent successfully to ${request.to}`);
            return { success: true, to: request.to };
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            this.logger.error(`SMS send error for ${request.to}: ${message}`);
            return { success: false, to: request.to, error: message };
        }
    }

    async sendBulk(requests: SmsSendRequest[]): Promise<SmsSendResult[]> {
        const results: SmsSendResult[] = [];
        for (const req of requests) {
            results.push(await this.send(req));
        }
        return results;
    }

    private isValidPhoneNumber(phone: string): boolean {
        // Basic validation: digits, optional + prefix, 7-15 chars
        return /^\+?\d{7,15}$/.test(phone.replace(/[\s\-()]/g, ''));
    }
}
