import { SmsProviderService, SmsSendRequest } from './sms-provider.service';
import { ConfigService } from '@nestjs/config';

describe('SmsProviderService', () => {
    let service: SmsProviderService;
    let configValues: Record<string, string>;

    beforeEach(() => {
        configValues = {
            SMS_REMOTE_URL: 'https://sms.example.com/api',
            SMS_PROVIDER_API_KEY: 'test-api-key',
            SMS_PROVIDER_TIMEOUT: '5000',
        };

        const mockConfig = {
            get: jest.fn((key: string, defaultValue?: any) => configValues[key] ?? defaultValue),
        } as unknown as ConfigService;

        service = new SmsProviderService(mockConfig);
    });

    describe('isConfigured', () => {
        it('should return true when all config values are set', () => {
            expect(service.isConfigured()).toBe(true);
        });

        it('should return false when base URL is missing', () => {
            configValues['SMS_REMOTE_URL'] = '';
            const mockConfig = {
                get: jest.fn((key: string, defaultValue?: any) => configValues[key] ?? defaultValue),
            } as unknown as ConfigService;
            const svc = new SmsProviderService(mockConfig);
            expect(svc.isConfigured()).toBe(false);
        });
    });

    describe('send', () => {
        it('should return failure when not configured', async () => {
            configValues['SMS_REMOTE_URL'] = '';
            const mockConfig = {
                get: jest.fn((key: string, defaultValue?: any) => configValues[key] ?? defaultValue),
            } as unknown as ConfigService;
            const svc = new SmsProviderService(mockConfig);

            const result = await svc.send({ to: '+972501234567', message: 'test' });
            expect(result.success).toBe(false);
            expect(result.error).toContain('not configured');
        });

        it('should return failure for invalid phone number', async () => {
            const result = await service.send({ to: 'invalid', message: 'test' });
            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid phone number');
        });

        it('should return failure for empty phone number', async () => {
            const result = await service.send({ to: '', message: 'test' });
            expect(result.success).toBe(false);
        });

        it('should handle fetch errors gracefully', async () => {
            const originalFetch = global.fetch;
            global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

            const result = await service.send({ to: '+972501234567', message: 'test' });
            expect(result.success).toBe(false);
            expect(result.error).toBe('Network error');

            global.fetch = originalFetch;
        });

        it('should handle non-OK responses', async () => {
            const originalFetch = global.fetch;
            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 500,
                text: () => Promise.resolve('Server Error'),
            });

            const result = await service.send({ to: '+972501234567', message: 'test' });
            expect(result.success).toBe(false);
            expect(result.error).toBe('HTTP 500');

            global.fetch = originalFetch;
        });

        it('should return success on OK response', async () => {
            const originalFetch = global.fetch;
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
            });

            const result = await service.send({ to: '+972501234567', message: 'test' });
            expect(result.success).toBe(true);
            expect(result.to).toBe('+972501234567');

            global.fetch = originalFetch;
        });
    });

    describe('sendBulk', () => {
        it('should send to all recipients and return results', async () => {
            const originalFetch = global.fetch;
            global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });

            const requests: SmsSendRequest[] = [
                { to: '+972501234567', message: 'msg1' },
                { to: '+972507654321', message: 'msg2' },
            ];

            const results = await service.sendBulk(requests);
            expect(results).toHaveLength(2);
            expect(results[0].success).toBe(true);
            expect(results[1].success).toBe(true);

            global.fetch = originalFetch;
        });
    });
});
