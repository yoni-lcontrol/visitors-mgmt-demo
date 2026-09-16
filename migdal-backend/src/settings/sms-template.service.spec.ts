import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { SmsTemplateService } from './sms-template.service';
import { SmsTemplate } from './entities/sms-template.entity';
import { SmsTemplateRendererService } from './sms-template-renderer.service';
import { SmsProviderService } from './sms-provider.service';
import { createMockRepository, createMockAuditService } from '../test-utils/mock.factory';
import { AuditService } from '../audit/audit.service';

describe('SmsTemplateService', () => {
    let service: SmsTemplateService;
    let mockRepo: ReturnType<typeof createMockRepository>;
    let renderer: SmsTemplateRendererService;
    let mockAuditService: ReturnType<typeof createMockAuditService>;
    let mockSmsProvider: Record<string, jest.Mock>;

    beforeEach(async () => {
        mockRepo = createMockRepository();
        mockAuditService = createMockAuditService();
        mockSmsProvider = {
            isConfigured: jest.fn().mockReturnValue(true),
            send: jest.fn().mockResolvedValue({ success: true }),
            sendBulk: jest.fn().mockResolvedValue([]),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SmsTemplateService,
                SmsTemplateRendererService,
                { provide: getRepositoryToken(SmsTemplate), useValue: mockRepo },
                { provide: SmsProviderService, useValue: mockSmsProvider },
                { provide: AuditService, useValue: mockAuditService },
            ],
        }).compile();

        service = module.get<SmsTemplateService>(SmsTemplateService);
        renderer = module.get<SmsTemplateRendererService>(SmsTemplateRendererService);
    });

    describe('findAll', () => {
        it('should return all active templates', async () => {
            mockRepo.find.mockResolvedValue([
                { event: 'visit_created', template: '{{visit.title}}' },
            ]);
            const result = await service.findAll();
            expect(result).toHaveLength(1);
            expect(mockRepo.find).toHaveBeenCalledWith(expect.objectContaining({
                where: { isActive: true },
            }));
        });
    });

    describe('bulkUpsert', () => {
        it('should update existing template', async () => {
            const existing = { event: 'visit_created', targetGroup: 'visit_creator', template: 'old' };
            mockRepo.findOne.mockResolvedValue(existing);
            mockRepo.find.mockResolvedValue([{ ...existing, template: 'new' }]);
            mockRepo.save.mockImplementation((e: any) => Promise.resolve(e));

            await service.bulkUpsert([
                { event: 'visit_created', targetGroup: 'visit_creator', template: '{{visit.title}}' },
            ], 'admin');

            expect(mockRepo.save).toHaveBeenCalled();
        });

        it('should create new template when not found', async () => {
            mockRepo.findOne.mockResolvedValue(null);
            mockRepo.find.mockResolvedValue([]);
            mockRepo.save.mockImplementation((e: any) => Promise.resolve(e));

            await service.bulkUpsert([
                { event: 'visit_created', targetGroup: 'visit_creator', template: '{{visit.title}}' },
            ], 'admin');

            expect(mockRepo.create).toHaveBeenCalled();
            expect(mockRepo.save).toHaveBeenCalled();
        });

        it('should reject invalid placeholders', async () => {
            await expect(
                service.bulkUpsert([
                    { event: 'visit_created', targetGroup: 'visit_creator', template: '{{invalid.field}}' },
                ]),
            ).rejects.toThrow(BadRequestException);
        });

        it('should store recipients as JSON', async () => {
            mockRepo.findOne.mockResolvedValue(null);
            mockRepo.find.mockResolvedValue([]);
            mockRepo.save.mockImplementation((e: any) => Promise.resolve(e));

            await service.bulkUpsert([
                { event: 'visit_created', targetGroup: 'visit_creator', template: '{{visit.title}}', recipients: ['+972501234567'] },
            ], 'admin');

            expect(mockRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    recipients: JSON.stringify(['+972501234567']),
                }),
            );
        });
    });

    describe('preview', () => {
        it('should render stored template with sample data when no custom template', async () => {
            mockRepo.findOne.mockResolvedValue({
                event: 'visit_created',
                targetGroup: 'visit_creator',
                template: 'ביקור: {{visit.title}}',
            });

            const result = await service.preview('visit_created', undefined, 'visit_creator');
            expect(result.rendered).toContain('ביקור');
            expect(result.placeholders.length).toBeGreaterThan(0);
        });

        it('should render custom template with sample data', async () => {
            const result = await service.preview('visit_created', 'Custom: {{visitor.firstName}}');
            expect(result.rendered).toContain('Custom:');
        });

        it('should reject invalid placeholders in preview', async () => {
            await expect(
                service.preview('visit_created', '{{bad.field}}'),
            ).rejects.toThrow(BadRequestException);
        });
    });
});
