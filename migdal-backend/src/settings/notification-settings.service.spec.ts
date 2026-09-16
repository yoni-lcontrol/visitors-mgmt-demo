import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationSettingsService } from './notification-settings.service';
import { NotificationSetting } from './entities/notification-setting.entity';
import { createMockRepository, createMockAuditService } from '../test-utils/mock.factory';
import { AuditService } from '../audit/audit.service';

describe('NotificationSettingsService', () => {
    let service: NotificationSettingsService;
    let mockRepo: ReturnType<typeof createMockRepository>;
    let mockAuditService: ReturnType<typeof createMockAuditService>;

    beforeEach(async () => {
        mockRepo = createMockRepository();
        mockAuditService = createMockAuditService();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                NotificationSettingsService,
                { provide: getRepositoryToken(NotificationSetting), useValue: mockRepo },
                { provide: AuditService, useValue: mockAuditService },
            ],
        }).compile();

        service = module.get<NotificationSettingsService>(NotificationSettingsService);
    });

    describe('findAll', () => {
        it('should return all active notification settings', async () => {
            mockRepo.find.mockResolvedValue([{ targetGroup: 'visit_creator', event: 'visitor_arrived_with_escort', channel: 'email', enabled: true }]);
            const result = await service.findAll();
            expect(result).toHaveLength(1);
        });
    });

    describe('bulkUpsert', () => {
        it('should update existing setting', async () => {
            const existing = { targetGroup: 'visit_creator', event: 'visitor_arrived_with_escort', channel: 'email', enabled: false };
            mockRepo.findOne.mockResolvedValue(existing);
            mockRepo.find.mockResolvedValue([{ ...existing, enabled: true }]);
            mockRepo.save.mockImplementation((e: any) => Promise.resolve(e));

            const result = await service.bulkUpsert([
                { targetGroup: 'visit_creator', event: 'visitor_arrived_with_escort', channel: 'email', enabled: true },
            ], 'admin');

            expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
        });

        it('should create new setting when not found', async () => {
            mockRepo.findOne.mockResolvedValue(null);
            mockRepo.find.mockResolvedValue([]);
            mockRepo.save.mockImplementation((e: any) => Promise.resolve(e));

            await service.bulkUpsert([
                { targetGroup: 'visitors', event: 'visit_created', channel: 'sms', enabled: true },
            ], 'admin');

            expect(mockRepo.create).toHaveBeenCalled();
            expect(mockRepo.save).toHaveBeenCalled();
        });
    });

    describe('isEnabled', () => {
        it('should return true when setting is enabled', async () => {
            mockRepo.findOne.mockResolvedValue({ enabled: true });
            const result = await service.isEnabled('visit_creator', 'visitor_arrived_with_escort', 'email');
            expect(result).toBe(true);
        });

        it('should return false when setting not found', async () => {
            mockRepo.findOne.mockResolvedValue(null);
            const result = await service.isEnabled('visit_creator', 'unknown', 'sms');
            expect(result).toBe(false);
        });
    });
});
