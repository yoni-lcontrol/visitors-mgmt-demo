import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { Setting } from './entities/setting.entity';
import { createMockRepository, createMockWsGateway, createMockAuditService } from '../test-utils/mock.factory';
import { UsersGateway } from '../websocket/gateways/users.gateway';
import { AuditService } from '../audit/audit.service';

describe('SettingsService', () => {
    let service: SettingsService;
    let mockRepo: ReturnType<typeof createMockRepository>;
    let mockWs: ReturnType<typeof createMockWsGateway>;
    let mockAuditService: ReturnType<typeof createMockAuditService>;

    beforeEach(async () => {
        mockRepo = createMockRepository();
        mockWs = createMockWsGateway();
        mockAuditService = createMockAuditService();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SettingsService,
                { provide: getRepositoryToken(Setting), useValue: mockRepo },
                { provide: UsersGateway, useValue: mockWs },
                { provide: AuditService, useValue: mockAuditService },
            ],
        }).compile();

        service = module.get<SettingsService>(SettingsService);
    });

    describe('findAll', () => {
        it('should return all active settings', async () => {
            mockRepo.find.mockResolvedValue([{ key: 'site.name', value: 'Migdal' }]);
            const result = await service.findAll();
            expect(result).toHaveLength(1);
        });

        it('should filter by group', async () => {
            mockRepo.find.mockResolvedValue([]);
            await service.findAll('general');
            expect(mockRepo.find).toHaveBeenCalledWith(expect.objectContaining({
                where: { isActive: true, group: 'general' },
            }));
        });
    });

    describe('findByKey', () => {
        it('should return setting by key', async () => {
            mockRepo.findOne.mockResolvedValue({ key: 'site.name', value: 'Migdal' });
            const result = await service.findByKey('site.name');
            expect(result.value).toBe('Migdal');
        });

        it('should throw NotFoundException', async () => {
            mockRepo.findOne.mockResolvedValue(null);
            await expect(service.findByKey('bad')).rejects.toThrow(NotFoundException);
        });
    });

    describe('create', () => {
        it('should throw ConflictException for duplicate key', async () => {
            mockRepo.findOne.mockResolvedValue({ key: 'existing' });
            await expect(service.create({ key: 'existing', value: 'v', group: 'g', label: 'l' } as any))
                .rejects.toThrow(ConflictException);
        });

        it('should create setting', async () => {
            mockRepo.findOne.mockResolvedValue(null);
            mockRepo.save.mockImplementation((e: any) => Promise.resolve(e));

            await service.create({ key: 'new.key', value: 'val', group: 'g', label: 'l' } as any);
            expect(mockRepo.create).toHaveBeenCalled();
            expect(mockRepo.save).toHaveBeenCalled();
        });

        it('should audit log on create', async () => {
            mockRepo.findOne.mockResolvedValue(null);
            mockRepo.save.mockImplementation((e: any) => Promise.resolve({ ...e, key: 'new.key' }));
            await service.create({ key: 'new.key', value: 'val', group: 'g', label: 'l' } as any, 'user-1');
            expect(mockAuditService.log).toHaveBeenCalledWith(expect.objectContaining({
                module: 'settings', action: 'CREATE', entity: 'Setting', userId: 'user-1',
            }));
        });
    });

    describe('update', () => {
        it('should update and broadcast', async () => {
            const setting = { key: 'site.name', value: 'Old', group: 'general', isActive: true };
            mockRepo.findOne.mockResolvedValue(setting);
            mockRepo.save.mockImplementation((e: any) => Promise.resolve(e));

            await service.update('site.name', { value: 'New' } as any);
            expect(mockRepo.save).toHaveBeenCalled();
            expect(mockWs.broadcastToAll).toHaveBeenCalledWith('settings:setting:updated', expect.any(Object));
        });

        it('should reject empty value for retention setting', async () => {
            const setting = { key: 'retention.auditLogsMonths', value: '6', group: 'retention', isActive: true };
            mockRepo.findOne.mockResolvedValue(setting);

            await expect(service.update('retention.auditLogsMonths', { value: '' } as any))
                .rejects.toThrow(BadRequestException);
        });

        it('should allow valid positive integer for retention setting', async () => {
            const setting = { key: 'retention.visitsMonths', value: '', group: 'retention', isActive: true };
            mockRepo.findOne.mockResolvedValue(setting);
            mockRepo.save.mockImplementation((e: any) => Promise.resolve(e));

            await expect(service.update('retention.visitsMonths', { value: '12' } as any)).resolves.toBeDefined();
        });

        it('should reject zero retention value', async () => {
            const setting = { key: 'retention.auditLogsMonths', value: '6', group: 'retention', isActive: true };
            mockRepo.findOne.mockResolvedValue(setting);

            await expect(service.update('retention.auditLogsMonths', { value: '0' } as any))
                .rejects.toThrow(BadRequestException);
        });

        it('should reject negative retention value', async () => {
            const setting = { key: 'retention.visitsMonths', value: '12', group: 'retention', isActive: true };
            mockRepo.findOne.mockResolvedValue(setting);

            await expect(service.update('retention.visitsMonths', { value: '-5' } as any))
                .rejects.toThrow(BadRequestException);
        });

        it('should reject non-integer retention value', async () => {
            const setting = { key: 'retention.auditLogsMonths', value: '6', group: 'retention', isActive: true };
            mockRepo.findOne.mockResolvedValue(setting);

            await expect(service.update('retention.auditLogsMonths', { value: '3.5' } as any))
                .rejects.toThrow(BadRequestException);
        });

        it('should reject retention value exceeding 120', async () => {
            const setting = { key: 'retention.auditLogsMonths', value: '6', group: 'retention', isActive: true };
            mockRepo.findOne.mockResolvedValue(setting);

            await expect(service.update('retention.auditLogsMonths', { value: '121' } as any))
                .rejects.toThrow(BadRequestException);
        });

        it('should not validate non-retention setting values', async () => {
            const setting = { key: 'app.name', value: 'Old', group: 'general', isActive: true };
            mockRepo.findOne.mockResolvedValue(setting);
            mockRepo.save.mockImplementation((e: any) => Promise.resolve(e));

            await expect(service.update('app.name', { value: 'abc' } as any)).resolves.toBeDefined();
        });

        it('should validate deviceCommandLogsMonths with same rules as other retention keys', async () => {
            const setting = { key: 'retention.deviceCommandLogsMonths', value: '3', group: 'retention', isActive: true };
            mockRepo.findOne.mockResolvedValue(setting);

            await expect(service.update('retention.deviceCommandLogsMonths', { value: '0' } as any))
                .rejects.toThrow(BadRequestException);
            await expect(service.update('retention.deviceCommandLogsMonths', { value: '-1' } as any))
                .rejects.toThrow(BadRequestException);
            await expect(service.update('retention.deviceCommandLogsMonths', { value: '121' } as any))
                .rejects.toThrow(BadRequestException);
            await expect(service.update('retention.deviceCommandLogsMonths', { value: '3.5' } as any))
                .rejects.toThrow(BadRequestException);
        });

        it('should allow valid deviceCommandLogsMonths value', async () => {
            const setting = { key: 'retention.deviceCommandLogsMonths', value: '3', group: 'retention', isActive: true };
            mockRepo.findOne.mockResolvedValue(setting);
            mockRepo.save.mockImplementation((e: any) => Promise.resolve(e));

            await expect(service.update('retention.deviceCommandLogsMonths', { value: '6' } as any)).resolves.toBeDefined();
        });

        it('should audit log on update with old and new values', async () => {
            const setting = { key: 'site.name', value: 'Old', group: 'general', isActive: true };
            mockRepo.findOne.mockResolvedValue(setting);
            mockRepo.save.mockImplementation((e: any) => Promise.resolve(e));
            await service.update('site.name', { value: 'New' } as any, 'user-1');
            expect(mockAuditService.log).toHaveBeenCalledWith(expect.objectContaining({
                module: 'settings', action: 'UPDATE', entity: 'Setting',
                oldValue: expect.objectContaining({ value: 'Old' }),
                newValue: expect.objectContaining({ value: 'New' }),
            }));
        });
    });

    describe('remove', () => {
        it('should audit log on delete', async () => {
            mockRepo.findOne.mockResolvedValue({ key: 'del.key', isActive: true });
            mockRepo.save.mockImplementation((e: any) => Promise.resolve(e));
            await service.remove('del.key', 'user-1');
            expect(mockAuditService.log).toHaveBeenCalledWith(expect.objectContaining({
                module: 'settings', action: 'DELETE', entity: 'Setting', userId: 'user-1',
            }));
        });
    });

    describe('getValue', () => {
        it('should return value for existing key', async () => {
            mockRepo.findOne.mockResolvedValue({ key: 'k', value: 'v', isActive: true });
            const result = await service.getValue('k');
            expect(result).toBe('v');
        });

        it('should return null for missing key', async () => {
            mockRepo.findOne.mockResolvedValue(null);
            const result = await service.getValue('missing');
            expect(result).toBeNull();
        });
    });
});
