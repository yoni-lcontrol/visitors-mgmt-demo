import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { EmailTemplateService } from './email-template.service';
import { EmailTemplate } from './entities/email-template.entity';
import { EmailTemplateRendererService } from './email-template-renderer.service';
import { EmailProviderService } from './email-provider.service';
import { createMockRepository, createMockAuditService } from '../test-utils/mock.factory';
import { AuditService } from '../audit/audit.service';

describe('EmailTemplateService', () => {
    let service: EmailTemplateService;
    let mockRepo: ReturnType<typeof createMockRepository>;
    let renderer: EmailTemplateRendererService;
    let mockAuditService: ReturnType<typeof createMockAuditService>;
    let mockEmailProvider: Record<string, jest.Mock>;

    beforeEach(async () => {
        mockRepo = createMockRepository();
        mockAuditService = createMockAuditService();
        mockEmailProvider = {
            isConfigured: jest.fn().mockReturnValue(true),
            send: jest.fn().mockResolvedValue({ success: true }),
            sendBulk: jest.fn().mockResolvedValue([]),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EmailTemplateService,
                EmailTemplateRendererService,
                { provide: getRepositoryToken(EmailTemplate), useValue: mockRepo },
                { provide: EmailProviderService, useValue: mockEmailProvider },
                { provide: AuditService, useValue: mockAuditService },
            ],
        }).compile();

        service = module.get<EmailTemplateService>(EmailTemplateService);
        renderer = module.get<EmailTemplateRendererService>(EmailTemplateRendererService);
    });

    describe('findAll', () => {
        it('should return all active templates', async () => {
            mockRepo.find.mockResolvedValue([
                { event: 'visit_created', targetGroup: 'system_users', subject: 'Subject', bodyHtml: '<p>Body</p>' },
            ]);
            const result = await service.findAll();
            expect(result).toHaveLength(1);
            expect(mockRepo.find).toHaveBeenCalledWith(expect.objectContaining({
                where: { isActive: true },
            }));
        });
    });

    describe('loadTemplate', () => {
        it('should load template by event and targetGroup', async () => {
            const tpl = { event: 'visit_created', targetGroup: 'system_users', subject: 'Sub', bodyHtml: '<p>B</p>' };
            mockRepo.findOne.mockResolvedValue(tpl);

            const result = await service.loadTemplate('visit_created', 'system_users');
            expect(result).toEqual(tpl);
            expect(mockRepo.findOne).toHaveBeenCalledWith({
                where: { event: 'visit_created', targetGroup: 'system_users', isActive: true },
            });
        });

        it('should return null when template not found', async () => {
            mockRepo.findOne.mockResolvedValue(null);
            const result = await service.loadTemplate('nonexistent', 'system_users');
            expect(result).toBeNull();
        });
    });

    describe('bulkUpsert', () => {
        it('should update existing template', async () => {
            const existing = { event: 'visit_created', targetGroup: 'system_users', subject: 'old', bodyHtml: '<p>old</p>' };
            mockRepo.findOne.mockResolvedValue(existing);
            mockRepo.find.mockResolvedValue([{ ...existing, subject: 'new' }]);
            mockRepo.save.mockImplementation((e: any) => Promise.resolve(e));

            await service.bulkUpsert([
                { event: 'visit_created', targetGroup: 'system_users', subject: '{{visit.title}}', bodyHtml: '<p>{{visit.title}}</p>' },
            ], 'admin');

            expect(mockRepo.save).toHaveBeenCalled();
        });

        it('should create new template when not found', async () => {
            mockRepo.findOne.mockResolvedValue(null);
            mockRepo.find.mockResolvedValue([]);
            mockRepo.save.mockImplementation((e: any) => Promise.resolve(e));

            await service.bulkUpsert([
                { event: 'visit_created', targetGroup: 'system_users', subject: '{{visit.title}}', bodyHtml: '<p>{{visit.title}}</p>' },
            ], 'admin');

            expect(mockRepo.create).toHaveBeenCalled();
            expect(mockRepo.save).toHaveBeenCalled();
        });

        it('should reject invalid placeholders in subject', async () => {
            await expect(
                service.bulkUpsert([
                    { event: 'visit_created', targetGroup: 'system_users', subject: '{{invalid.field}}', bodyHtml: '<p>ok</p>' },
                ]),
            ).rejects.toThrow(BadRequestException);
        });

        it('should reject invalid placeholders in body', async () => {
            await expect(
                service.bulkUpsert([
                    { event: 'visit_created', targetGroup: 'system_users', subject: 'ok', bodyHtml: '<p>{{bad.field}}</p>' },
                ]),
            ).rejects.toThrow(BadRequestException);
        });

        it('should store recipients as JSON', async () => {
            mockRepo.findOne.mockResolvedValue(null);
            mockRepo.find.mockResolvedValue([]);
            mockRepo.save.mockImplementation((e: any) => Promise.resolve(e));

            await service.bulkUpsert([
                { event: 'visit_created', targetGroup: 'system_users', subject: '{{visit.title}}', bodyHtml: '<p>{{visit.title}}</p>', recipients: ['admin@example.com'] },
            ], 'admin');

            expect(mockRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    recipients: JSON.stringify(['admin@example.com']),
                }),
            );
        });
    });

    describe('preview', () => {
        it('should render stored template with sample data when no custom template', async () => {
            mockRepo.findOne.mockResolvedValue({
                event: 'visit_created',
                targetGroup: 'system_users',
                subject: 'ביקור: {{visit.title}}',
                bodyHtml: '<p>{{visit.title}}</p>',
            });

            const result = await service.preview('visit_created', undefined, undefined, 'system_users');
            expect(result.renderedSubject).toContain('ביקור');
            expect(result.renderedBody).toBeDefined();
            expect(result.placeholders.length).toBeGreaterThan(0);
        });

        it('should render custom subject and body with sample data', async () => {
            const result = await service.preview(
                'visit_created',
                'Custom: {{visitor.firstName}}',
                '<p>Custom: {{visitor.firstName}}</p>',
            );
            expect(result.renderedSubject).toContain('Custom:');
            expect(result.renderedBody).toContain('Custom:');
        });

        it('should reject invalid placeholders in preview subject', async () => {
            await expect(
                service.preview('visit_created', '{{bad.field}}', '<p>ok</p>'),
            ).rejects.toThrow(BadRequestException);
        });

        it('should reject invalid placeholders in preview body', async () => {
            await expect(
                service.preview('visit_created', 'ok', '<p>{{bad.field}}</p>'),
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('testEmail', () => {
        it('should render and send test email', async () => {
            mockEmailProvider.send.mockResolvedValue({ success: true });

            const result = await service.testEmail('test@example.com', '{{visit.title}}', '<p>{{visit.title}}</p>');
            expect(result.success).toBe(true);
            expect(mockEmailProvider.send).toHaveBeenCalled();
        });

        it('should throw when provider is not configured', async () => {
            mockEmailProvider.isConfigured.mockReturnValue(false);

            await expect(
                service.testEmail('test@example.com', 'sub', '<p>body</p>'),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw when send fails', async () => {
            mockEmailProvider.send.mockResolvedValue({ success: false, error: 'SMTP error' });

            await expect(
                service.testEmail('test@example.com', '{{visit.title}}', '<p>{{visit.title}}</p>'),
            ).rejects.toThrow(BadRequestException);
        });
    });
});
