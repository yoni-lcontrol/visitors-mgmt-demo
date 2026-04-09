import { EmailProviderService, EmailSendRequest } from './email-provider.service';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer');
const mockedNodemailer = nodemailer as jest.Mocked<typeof nodemailer>;

describe('EmailProviderService', () => {
    let service: EmailProviderService;
    let configValues: Record<string, string>;
    let mockSendMail: jest.Mock;

    beforeEach(() => {
        configValues = {
            SMTP_HOST: 'smtp.example.com',
            SMTP_PORT: '587',
            SMTP_SECURE: 'false',
            SMTP_USER: 'user@example.com',
            SMTP_PASS: 'secret',
            SMTP_FROM: 'noreply@example.com',
        };

        mockSendMail = jest.fn().mockResolvedValue({ messageId: '123' });
        mockedNodemailer.createTransport.mockReturnValue({ sendMail: mockSendMail } as any);

        const mockConfig = {
            get: jest.fn((key: string, defaultValue?: any) => configValues[key] ?? defaultValue),
        } as unknown as ConfigService;

        service = new EmailProviderService(mockConfig);
    });

    describe('isConfigured', () => {
        it('should return true when SMTP_HOST is set', () => {
            expect(service.isConfigured()).toBe(true);
        });

        it('should return false when SMTP_HOST is missing', () => {
            configValues['SMTP_HOST'] = '';
            const mockConfig = {
                get: jest.fn((key: string, defaultValue?: any) => configValues[key] ?? defaultValue),
            } as unknown as ConfigService;
            const svc = new EmailProviderService(mockConfig);
            expect(svc.isConfigured()).toBe(false);
        });
    });

    describe('send', () => {
        it('should return failure when not configured', async () => {
            configValues['SMTP_HOST'] = '';
            const mockConfig = {
                get: jest.fn((key: string, defaultValue?: any) => configValues[key] ?? defaultValue),
            } as unknown as ConfigService;
            const svc = new EmailProviderService(mockConfig);

            const result = await svc.send({ to: 'test@example.com', subject: 'Test', html: '<p>Hi</p>' });
            expect(result.success).toBe(false);
            expect(result.error).toContain('not configured');
        });

        it('should return failure for invalid email address', async () => {
            const result = await service.send({ to: 'invalid', subject: 'Test', html: '<p>Hi</p>' });
            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid email');
        });

        it('should return failure for empty email address', async () => {
            const result = await service.send({ to: '', subject: 'Test', html: '<p>Hi</p>' });
            expect(result.success).toBe(false);
        });

        it('should handle sendMail errors gracefully', async () => {
            mockSendMail.mockRejectedValue(new Error('Connection refused'));

            const result = await service.send({ to: 'test@example.com', subject: 'Test', html: '<p>Hi</p>' });
            expect(result.success).toBe(false);
            expect(result.error).toBe('Connection refused');
        });

        it('should return success when sendMail succeeds', async () => {
            const result = await service.send({ to: 'test@example.com', subject: 'Test', html: '<p>Hi</p>' });
            expect(result.success).toBe(true);
            expect(result.to).toBe('test@example.com');
            expect(mockSendMail).toHaveBeenCalledWith({
                from: 'noreply@example.com',
                to: 'test@example.com',
                subject: 'Test',
                html: '<p>Hi</p>',
            });
        });
    });

    describe('sendBulk', () => {
        it('should send to all recipients and return results', async () => {
            const requests: EmailSendRequest[] = [
                { to: 'a@example.com', subject: 'S1', html: '<p>1</p>' },
                { to: 'b@example.com', subject: 'S2', html: '<p>2</p>' },
            ];

            const results = await service.sendBulk(requests);
            expect(results).toHaveLength(2);
            expect(results[0].success).toBe(true);
            expect(results[1].success).toBe(true);
            expect(mockSendMail).toHaveBeenCalledTimes(2);
        });
    });
});
