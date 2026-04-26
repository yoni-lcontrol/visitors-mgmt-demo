import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { AdConfigurationService } from './ad-configuration.service';
import { AdConfiguration } from './entities/ad-configuration.entity';
import { createMockRepository, createMockAuditService } from '../test-utils/mock.factory';
import { AuditService } from '../audit/audit.service';

describe('AdConfigurationService', () => {
    let service: AdConfigurationService;
    let mockRepo: ReturnType<typeof createMockRepository>;
    let mockAuditService: ReturnType<typeof createMockAuditService>;

    beforeEach(async () => {
        mockRepo = createMockRepository();
        mockAuditService = createMockAuditService();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AdConfigurationService,
                { provide: getRepositoryToken(AdConfiguration), useValue: mockRepo },
                { provide: AuditService, useValue: mockAuditService },
            ],
        }).compile();

        service = module.get<AdConfigurationService>(AdConfigurationService);
    });

    describe('findAll', () => {
        it('should return active AD configurations', async () => {
            mockRepo.find.mockResolvedValue([{ id: '1', name: 'Corp AD' }]);
            const result = await service.findAll();
            expect(result).toHaveLength(1);
            expect(mockRepo.find).toHaveBeenCalledWith(expect.objectContaining({
                where: { isActive: true },
            }));
        });
    });

    describe('findById', () => {
        it('should return AD configuration', async () => {
            mockRepo.findOne.mockResolvedValue({ id: '1', name: 'Corp AD', targetGroupsJson: null });
            const result = await service.findById('1');
            expect(result.name).toBe('Corp AD');
            expect(result.targetGroups).toEqual([]);
        });

        it('should parse targetGroups from json', async () => {
            mockRepo.findOne.mockResolvedValue({
                id: '1',
                name: 'Corp AD',
                domain: 'corp.local',
                ldapUrl: 'ldap://dc01',
                baseDn: null,
                username: 'svc',
                password: 'secret',
                port: 389,
                useSsl: false,
                description: null,
                targetGroupsJson: '["Reception","Visitors Operators"]',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdBy: null,
                updatedBy: null,
            });

            const result = await service.findById('1');
            expect(result.targetGroups).toEqual(['Reception', 'Visitors Operators']);
        });

        it('should throw NotFoundException', async () => {
            mockRepo.findOne.mockResolvedValue(null);
            await expect(service.findById('bad')).rejects.toThrow(NotFoundException);
        });
    });

    describe('create', () => {
        it('should create AD configuration', async () => {
            mockRepo.save.mockImplementation((e: any) => Promise.resolve({ id: 'new', ...e }));

            const result = await service.create({
                name: 'Test AD', domain: 'test.local', ldapUrl: 'ldap://dc:389',
                username: 'admin', password: 'pass',
            } as any, 'user-1');

            expect(mockRepo.create).toHaveBeenCalled();
            expect(mockRepo.save).toHaveBeenCalled();
        });

        it('should audit log on create', async () => {
            mockRepo.findOne.mockResolvedValue(null);
            mockRepo.save.mockImplementation((e: any) => Promise.resolve({ id: 'ad-1', ...e }));
            await service.create({ name: 'Test AD', domain: 'test.com', ldapUrl: 'ldap://test', username: 'admin', password: 'secret', port: 389 } as any, 'user-1');
            expect(mockAuditService.log).toHaveBeenCalledWith(expect.objectContaining({
                module: 'settings', action: 'CREATE', entity: 'AdConfiguration',
                newValue: expect.objectContaining({ password: '***' }),
            }));
        });

        it('should normalize empty baseDn to null on create', async () => {
            let createdEntity: any;
            mockRepo.create.mockImplementation((e: any) => { createdEntity = e; return e; });
            mockRepo.save.mockImplementation((e: any) => Promise.resolve({ id: 'ad-1', ...e }));
            await service.create({ name: 'Test AD', domain: 'test.com', ldapUrl: 'ldap://test', baseDn: '', username: 'admin', password: 'secret' } as any, 'user-1');
            expect(createdEntity.baseDn).toBeNull();
        });

        it('should serialize and deduplicate targetGroups on create', async () => {
            let createdEntity: any;
            mockRepo.create.mockImplementation((e: any) => { createdEntity = e; return e; });
            mockRepo.save.mockImplementation((e: any) => Promise.resolve({ id: 'ad-1', ...e }));

            await service.create({
                name: 'Test AD',
                domain: 'test.com',
                ldapUrl: 'ldap://test',
                username: 'admin',
                password: 'secret',
                targetGroups: [' Reception ', 'reception', 'Visitors Operators'],
            } as any, 'user-1');

            expect(createdEntity.targetGroupsJson).toBe('["Reception","Visitors Operators"]');
        });
    });

    describe('update', () => {
        it('should update AD configuration', async () => {
            const config = { id: '1', name: 'Old', isActive: true };
            mockRepo.findOne.mockResolvedValue(config);
            mockRepo.save.mockImplementation((e: any) => Promise.resolve(e));

            await service.update('1', { name: 'Updated' } as any, 'user-1');
            expect(mockRepo.save).toHaveBeenCalled();
        });

        it('should audit log on update with masked sensitive fields', async () => {
            mockRepo.findOne.mockResolvedValue({ id: 'ad-1', name: 'Old', domain: 'old.com', ldapUrl: 'ldap://old', port: 389, useSsl: false, baseDn: null, isActive: true });
            mockRepo.save.mockImplementation((e: any) => Promise.resolve(e));
            await service.update('ad-1', { name: 'New' } as any, 'user-1');
            expect(mockAuditService.log).toHaveBeenCalledWith(expect.objectContaining({
                module: 'settings', action: 'UPDATE', entity: 'AdConfiguration',
            }));
        });

        it('should normalize empty baseDn to null on update', async () => {
            const entity = { id: 'ad-1', name: 'Old', domain: 'old.com', ldapUrl: 'ldap://old', port: 389, useSsl: false, baseDn: 'DC=old,DC=com', targetGroupsJson: null, isActive: true };
            mockRepo.findOne.mockResolvedValue(entity);
            mockRepo.save.mockImplementation((e: any) => Promise.resolve(e));
            await service.update('ad-1', { baseDn: '' } as any, 'user-1');
            expect(entity.baseDn).toBeNull();
        });

        it('should serialize targetGroups on update', async () => {
            const entity = {
                id: 'ad-1',
                name: 'Old',
                domain: 'old.com',
                ldapUrl: 'ldap://old',
                port: 389,
                useSsl: false,
                baseDn: null,
                targetGroupsJson: null,
                isActive: true,
            };
            mockRepo.findOne.mockResolvedValue(entity);
            mockRepo.save.mockImplementation((e: any) => Promise.resolve(e));

            await service.update('ad-1', { targetGroups: ['Reception', 'reception'] } as any, 'user-1');

            expect(entity.targetGroupsJson).toBe('["Reception"]');
        });
    });

    describe('remove', () => {
        it('should soft-delete AD configuration', async () => {
            const config = { id: '1', isActive: true };
            mockRepo.findOne.mockResolvedValue(config);

            await service.remove('1', 'user-1');
            expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
        });

        it('should audit log on delete', async () => {
            mockRepo.findOne.mockResolvedValue({ id: 'ad-1', name: 'Test', isActive: true });
            mockRepo.save.mockImplementation((e: any) => Promise.resolve(e));
            await service.remove('ad-1', 'user-1');
            expect(mockAuditService.log).toHaveBeenCalledWith(expect.objectContaining({
                module: 'settings', action: 'DELETE', entity: 'AdConfiguration', entityId: 'ad-1',
            }));
        });
    });
});
