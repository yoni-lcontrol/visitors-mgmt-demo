import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailTemplateService } from './email-template.service';
import { EmailTemplateRendererService } from './email-template-renderer.service';
import { EmailProviderService } from './email-provider.service';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

const mockEmailProvider = {
    isConfigured: jest.fn().mockReturnValue(true),
    send: jest.fn().mockResolvedValue(undefined),
    sendBulk: jest.fn().mockResolvedValue(undefined),
} as unknown as EmailProviderService;

describe('EmailTemplateService', () => {
    let service: EmailTemplateService;
    let renderer: EmailTemplateRendererService;

    beforeEach(() => {
        renderer = new EmailTemplateRendererService();
        const mockConfig = {
            get: jest.fn((key: string, defaultValue?: any) => {
                if (key === 'EMAIL_RECIPIENTS') return 'a@example.com,b@example.com';
                return defaultValue;
            }),
        } as unknown as ConfigService;

        // Mock the templates directory listing
        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readdirSync.mockReturnValue([
            { name: 'visit_created', isDirectory: () => true },
            { name: 'visitor_arrived', isDirectory: () => true },
        ] as any);
        mockedFs.readFileSync.mockImplementation((filePath: any) => {
            const p = String(filePath);
            if (p.endsWith('layout.html')) return '<html>{{BADGE_TEXT}} {{BADGE_BG}} {{BADGE_COLOR}} {{SUBJECT}} {{CONTENT}}</html>';
            if (p.endsWith('subject.txt')) return 'Subject: {{visit.title}}';
            if (p.endsWith('body.html')) return '<p>{{visit.title}}</p>';
            return '';
        });

        service = new EmailTemplateService(renderer, mockEmailProvider, mockConfig);
    });

    describe('getRecipients', () => {
        it('should return recipients from config', () => {
            const recipients = service.getRecipients();
            expect(recipients).toEqual(['a@example.com', 'b@example.com']);
        });

        it('should return empty array when no recipients configured', () => {
            const mockConfig = {
                get: jest.fn((key: string, defaultValue?: any) => defaultValue ?? ''),
            } as unknown as ConfigService;
            const svc = new EmailTemplateService(renderer, mockEmailProvider, mockConfig);
            expect(svc.getRecipients()).toEqual([]);
        });
    });

    describe('findAll', () => {
        it('should return templates for all event directories', () => {
            const result = service.findAll();
            expect(result).toHaveLength(2);
            expect(result[0].event).toBe('visit_created');
            expect(result[0].subject).toBe('Subject: {{visit.title}}');
        });

        it('should return empty array when templates dir does not exist', () => {
            mockedFs.existsSync.mockReturnValue(false);
            const mockConfig = {
                get: jest.fn((key: string, defaultValue?: any) => defaultValue ?? ''),
            } as unknown as ConfigService;
            const svc = new EmailTemplateService(renderer, mockEmailProvider, mockConfig);
            expect(svc.findAll()).toEqual([]);
        });
    });

    describe('loadTemplate', () => {
        it('should load subject and body wrapped in layout', () => {
            const result = service.loadTemplate('visit_created');
            expect(result).not.toBeNull();
            expect(result!.event).toBe('visit_created');
            expect(result!.subject).toBe('Subject: {{visit.title}}');
            expect(result!.bodyHtml).toContain('<p>{{visit.title}}</p>');
            expect(result!.bodyHtml).toContain('<html>');
            expect(result!.bodyHtml).toContain('ביקור חדש');
        });

        it('should return null when files are missing', () => {
            mockedFs.existsSync.mockReturnValue(false);
            const result = service.loadTemplate('nonexistent');
            expect(result).toBeNull();
        });
    });

    describe('preview', () => {
        it('should render stored template with sample data when no custom template', () => {
            const result = service.preview('visit_created');
            expect(result.renderedSubject).toContain('ביקור');
            expect(result.renderedBody).toContain('ביקור');
            expect(result.placeholders.length).toBeGreaterThan(0);
        });

        it('should render custom subject and body with sample data', () => {
            const result = service.preview(
                'visit_created',
                'Custom: {{visitor.firstName}}',
                '<p>Custom: {{visitor.firstName}}</p>',
            );
            expect(result.renderedSubject).toContain('Custom:');
            expect(result.renderedBody).toContain('Custom:');
        });

        it('should reject invalid placeholders in preview subject', () => {
            expect(() =>
                service.preview('visit_created', '{{bad.field}}', '<p>ok</p>'),
            ).toThrow(BadRequestException);
        });

        it('should reject invalid placeholders in preview body', () => {
            expect(() =>
                service.preview('visit_created', 'ok', '<p>{{bad.field}}</p>'),
            ).toThrow(BadRequestException);
        });
    });
});
