import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { WorkstationsService } from './workstations.service';
import { Workstation } from '../entities/workstation.entity';
import { WorkstationUser } from '../entities/workstation-user.entity';
import { WorkstationRole } from '../entities/workstation-role.entity';
import { WorkstationEnrollmentToken } from '../entities/workstation-enrollment-token.entity';
import { DeviceAgent } from '../../agents/entities/device-agent.entity';
import { Role } from '../../roles/entities/role.entity';
import { AuditService } from '../../audit/audit.service';
import { createMockRepository } from '../../test-utils/mock.factory';

describe('WorkstationsService', () => {
    let service: WorkstationsService;
    let workstationRepo: ReturnType<typeof createMockRepository>;
    let workstationUserRepo: ReturnType<typeof createMockRepository>;
    let workstationRoleRepo: ReturnType<typeof createMockRepository>;
    let enrollmentTokenRepo: ReturnType<typeof createMockRepository>;
    let deviceAgentRepo: ReturnType<typeof createMockRepository>;
    let roleRepo: ReturnType<typeof createMockRepository>;
    let auditService: { log: jest.Mock };

    beforeEach(async () => {
        workstationRepo = createMockRepository();
        workstationUserRepo = createMockRepository();
        workstationRoleRepo = createMockRepository();
        enrollmentTokenRepo = createMockRepository();
        deviceAgentRepo = createMockRepository();
        roleRepo = createMockRepository();
        auditService = { log: jest.fn().mockResolvedValue(undefined) };

        // Provide createQueryBuilder mocks for count queries
        workstationUserRepo.createQueryBuilder = jest.fn().mockReturnValue({
            select: jest.fn().mockReturnThis(),
            addSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            groupBy: jest.fn().mockReturnThis(),
            getRawMany: jest.fn().mockResolvedValue([]),
        });
        workstationRoleRepo.createQueryBuilder = jest.fn().mockReturnValue({
            select: jest.fn().mockReturnThis(),
            addSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            groupBy: jest.fn().mockReturnThis(),
            getRawMany: jest.fn().mockResolvedValue([]),
        });

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WorkstationsService,
                { provide: getRepositoryToken(Workstation), useValue: workstationRepo },
                { provide: getRepositoryToken(WorkstationUser), useValue: workstationUserRepo },
                { provide: getRepositoryToken(WorkstationRole), useValue: workstationRoleRepo },
                { provide: getRepositoryToken(WorkstationEnrollmentToken), useValue: enrollmentTokenRepo },
                { provide: getRepositoryToken(DeviceAgent), useValue: deviceAgentRepo },
                { provide: getRepositoryToken(Role), useValue: roleRepo },
                { provide: AuditService, useValue: auditService },
            ],
        }).compile();

        service = module.get<WorkstationsService>(WorkstationsService);
    });

    describe('findAll', () => {
        it('should return all active workstations', async () => {
            const workstations = [
                { id: 'ws-1', code: 'WS-001', displayName: 'WS 01', isActive: true },
                { id: 'ws-2', code: 'WS-002', displayName: 'WS 02', isActive: true },
            ];
            workstationRepo.find.mockResolvedValue(workstations);

            const result = await service.findAll();

            expect(result).toHaveLength(2);
            expect(workstationRepo.find).toHaveBeenCalledWith(
                expect.objectContaining({ where: { isActive: true } }),
            );
        });
    });

    describe('findById', () => {
        it('should return workstation by id', async () => {
            const ws = { id: 'ws-1', code: 'WS-001', displayName: 'Test', isActive: true };
            workstationRepo.findOne.mockResolvedValue(ws);

            const result = await service.findById('ws-1');
            expect(result.id).toBe('ws-1');
        });

        it('should throw NotFoundException if not found', async () => {
            workstationRepo.findOne.mockResolvedValue(null);

            await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
        });
    });

    describe('create', () => {
        it('should create a workstation', async () => {
            const dto = { displayName: 'New WS', code: 'WS-003' };
            workstationRepo.findOne.mockResolvedValue(null); // no duplicate code
            workstationRepo.create.mockReturnValue({ ...dto, id: 'ws-new' });
            workstationRepo.save.mockResolvedValue({ id: 'ws-new', ...dto });

            const result = await service.create(dto as any, 'admin-1');

            expect(result.id).toBe('ws-new');
            expect(workstationRepo.save).toHaveBeenCalled();
            expect(auditService.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'CREATE', entity: 'Workstation' }),
            );
        });

        it('should throw ConflictException for duplicate code', async () => {
            workstationRepo.findOne.mockResolvedValue({ id: 'existing', code: 'WS-001' });

            await expect(service.create({ displayName: 'Dup', code: 'WS-001' } as any, 'admin-1'))
                .rejects.toThrow(ConflictException);
        });

        it('should create a workstation with defaultCardTemplateId', async () => {
            const dto = { displayName: 'Print WS', code: 'WS-PRINT', defaultCardTemplateId: 'tmpl-1' };
            workstationRepo.findOne.mockResolvedValue(null);
            workstationRepo.create.mockReturnValue({ ...dto, id: 'ws-print' });
            workstationRepo.save.mockResolvedValue({ id: 'ws-print', ...dto });

            const result = await service.create(dto as any, 'admin-1');

            expect(workstationRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({ defaultCardTemplateId: 'tmpl-1' }),
            );
            expect(result.id).toBe('ws-print');
        });
    });

    describe('update', () => {
        it('should update workstation fields', async () => {
            const ws = { id: 'ws-1', displayName: 'Old', description: null, siteId: null, isActive: true };
            workstationRepo.findOne.mockResolvedValue(ws);
            workstationRepo.save.mockResolvedValue({ ...ws, displayName: 'Updated' });

            const result = await service.update('ws-1', { displayName: 'Updated' } as any, 'admin-1');

            expect(result.displayName).toBe('Updated');
            expect(auditService.log).toHaveBeenCalled();
        });

        it('should update defaultCardTemplateId', async () => {
            const ws = { id: 'ws-1', displayName: 'WS', description: null, siteId: null, defaultCardTemplateId: null, isActive: true };
            workstationRepo.findOne.mockResolvedValue(ws);
            workstationRepo.save.mockResolvedValue({ ...ws, defaultCardTemplateId: 'tmpl-2' });

            const result = await service.update('ws-1', { defaultCardTemplateId: 'tmpl-2' } as any, 'admin-1');

            expect(result.defaultCardTemplateId).toBe('tmpl-2');
        });

        it('should clear defaultCardTemplateId when set to null', async () => {
            const ws = { id: 'ws-1', displayName: 'WS', description: null, siteId: null, defaultCardTemplateId: 'tmpl-1', isActive: true };
            workstationRepo.findOne.mockResolvedValue(ws);
            workstationRepo.save.mockResolvedValue({ ...ws, defaultCardTemplateId: null });

            const result = await service.update('ws-1', { defaultCardTemplateId: null } as any, 'admin-1');

            expect(result.defaultCardTemplateId).toBeNull();
        });
    });

    describe('remove', () => {
        it('should soft-delete workstation', async () => {
            const ws = { id: 'ws-1', code: 'WS-001', isActive: true };
            workstationRepo.findOne.mockResolvedValue(ws);
            workstationRepo.save.mockResolvedValue({ ...ws, isActive: false });

            await service.remove('ws-1', 'admin-1');

            expect(workstationRepo.save).toHaveBeenCalledWith(
                expect.objectContaining({ isActive: false }),
            );
        });
    });

    describe('assignUsers', () => {
        it('should replace user assignments', async () => {
            workstationRepo.findOne.mockResolvedValue({ id: 'ws-1', isActive: true });
            workstationUserRepo.create.mockImplementation((data) => data);
            workstationUserRepo.save.mockResolvedValue([]);

            await service.assignUsers('ws-1', ['u1', 'u2'], 'admin-1');

            expect(workstationUserRepo.delete).toHaveBeenCalled(); // remove existing
            expect(workstationUserRepo.save).toHaveBeenCalled();
            expect(auditService.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'ASSIGN_USERS' }),
            );
        });
    });

    describe('assignRoles', () => {
        it('should replace role assignments', async () => {
            workstationRepo.findOne.mockResolvedValue({ id: 'ws-1', isActive: true });
            workstationRoleRepo.create.mockImplementation((data) => data);
            workstationRoleRepo.save.mockResolvedValue([]);

            await service.assignRoles('ws-1', ['r1'], 'admin-1');

            expect(workstationRoleRepo.delete).toHaveBeenCalled();
            expect(workstationRoleRepo.save).toHaveBeenCalled();
        });
    });

    describe('canUserAccessWorkstation', () => {
        it('should return true for directly assigned user', async () => {
            workstationUserRepo.findOne.mockResolvedValue({ userId: 'u1', workstationId: 'ws-1' });

            const result = await service.canUserAccessWorkstation('u1', [], 'ws-1');
            expect(result).toBe(true);
        });

        it('should return true for user with assigned role', async () => {
            workstationUserRepo.findOne.mockResolvedValue(null);
            workstationRoleRepo.findOne.mockResolvedValue({ roleId: 'r1', workstationId: 'ws-1' });

            const result = await service.canUserAccessWorkstation('u1', ['r1'], 'ws-1');
            expect(result).toBe(true);
        });

        it('should return false for user without access', async () => {
            workstationUserRepo.findOne.mockResolvedValue(null);
            workstationRoleRepo.findOne.mockResolvedValue(null);

            const result = await service.canUserAccessWorkstation('u1', ['r2'], 'ws-1');
            expect(result).toBe(false);
        });
    });

    describe('createEnrollmentToken', () => {
        it('should generate a token and save hash', async () => {
            workstationRepo.findOne.mockResolvedValue({ id: 'ws-1', isActive: true });
            enrollmentTokenRepo.create.mockImplementation((data) => data);
            enrollmentTokenRepo.save.mockResolvedValue({});

            const result = await service.createEnrollmentToken('ws-1', 'printer', 'admin-1');

            expect(result.token).toBeDefined();
            expect(result.token).toHaveLength(64); // 32 bytes hex
            expect(result.expiresAt).toBeInstanceOf(Date);
            expect(enrollmentTokenRepo.update).toHaveBeenCalled(); // invalidate old tokens
            expect(enrollmentTokenRepo.save).toHaveBeenCalled();
        });
    });

    describe('validateEnrollmentToken', () => {
        it('should return null for unknown token', async () => {
            enrollmentTokenRepo.findOne.mockResolvedValue(null);

            const result = await service.validateEnrollmentToken('nonexistent-token');
            expect(result).toBeNull();
        });

        it('should return null for expired token', async () => {
            const expired = new Date();
            expired.setHours(expired.getHours() - 1);
            enrollmentTokenRepo.findOne.mockResolvedValue({
                workstationId: 'ws-1',
                providerType: 'printer',
                id: 'token-1',
                expiresAt: expired,
                isUsed: false,
            });

            const result = await service.validateEnrollmentToken('some-token');
            expect(result).toBeNull();
        });

        it('should return valid token info for valid token', async () => {
            const future = new Date();
            future.setHours(future.getHours() + 12);
            enrollmentTokenRepo.findOne.mockResolvedValue({
                id: 'token-1',
                workstationId: 'ws-1',
                providerType: 'printer',
                expiresAt: future,
                isUsed: false,
            });

            const result = await service.validateEnrollmentToken('valid-token');
            expect(result).toEqual({
                workstationId: 'ws-1',
                providerType: 'printer',
                tokenId: 'token-1',
            });
        });
    });

    describe('markEnrollmentTokenUsed', () => {
        it('should mark token as used', async () => {
            await service.markEnrollmentTokenUsed('token-1', 'agent-1');

            expect(enrollmentTokenRepo.update).toHaveBeenCalledWith(
                { id: 'token-1' },
                expect.objectContaining({ isUsed: true, usedByAgentId: 'agent-1' }),
            );
        });
    });
});
