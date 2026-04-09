import { Test, TestingModule } from '@nestjs/testing';
import { WorkstationsController } from './workstations.controller';
import { WorkstationsService } from './services/workstations.service';
import { WorkstationSessionService } from './services/workstation-session.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('WorkstationsController', () => {
    let controller: WorkstationsController;
    let workstationsService: Record<string, jest.Mock>;
    let sessionService: Record<string, jest.Mock>;

    const mockUser = { sub: 'user-1', username: 'admin', roles: ['Admin'], roleIds: ['role-1'], permissions: [] };

    beforeEach(async () => {
        workstationsService = {
            findAllWithDeviceStatus: jest.fn().mockResolvedValue([
                {
                    id: 'ws-1',
                    code: 'WS-001',
                    displayName: 'WS 01',
                    machineId: 'm1',
                    hostname: 'host1',
                    devices: [{ providerType: 'printer', isConnected: true }],
                    assignedUsers: 2,
                    assignedRoles: 1,
                },
            ]),
            findByIdWithDetails: jest.fn().mockResolvedValue({
                workstation: { id: 'ws-1', code: 'WS-001', displayName: 'WS 01' },
                assignedUserIds: ['u1'],
                assignedRoleIds: ['r1'],
                agents: [],
            }),
            create: jest.fn().mockResolvedValue({ id: 'ws-new', code: 'WS-002', displayName: 'New WS' }),
            update: jest.fn().mockResolvedValue({ id: 'ws-1', displayName: 'Updated WS' }),
            remove: jest.fn().mockResolvedValue(undefined),
            assignUsers: jest.fn().mockResolvedValue(undefined),
            assignRoles: jest.fn().mockResolvedValue(undefined),
            createEnrollmentToken: jest.fn().mockResolvedValue({ token: 'abc123', expiresAt: new Date() }),
            getAccessibleWorkstationsWithDeviceStatus: jest.fn().mockResolvedValue([
                { id: 'ws-1', code: 'WS-001', displayName: 'WS 01', machineId: 'm1', hostname: 'host1', devices: [{ providerType: 'printer', isConnected: true }] },
            ]),
            getAvailableRoles: jest.fn().mockResolvedValue([{ id: 'r1', name: 'Admin' }]),
        };

        sessionService = {
            bindUserToWorkstationWithDeviceStatus: jest.fn().mockResolvedValue({
                workstationId: 'ws-1',
                code: 'WS-001',
                displayName: 'WS 01',
                devices: [
                    { providerType: 'printer', isConnected: false, agentVersion: null, lastSeenAt: null, capabilities: null },
                    { providerType: 'scanner', isConnected: false, agentVersion: null, lastSeenAt: null, capabilities: null },
                ],
            }),
            getActiveSessionWithDeviceStatus: jest.fn().mockResolvedValue({
                workstationId: 'ws-1',
                code: 'WS-001',
                displayName: 'WS 01',
                devices: [
                    { providerType: 'printer', isConnected: true, agentVersion: null, lastSeenAt: null, capabilities: null },
                    { providerType: 'scanner', isConnected: false, agentVersion: null, lastSeenAt: null, capabilities: null },
                ],
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [WorkstationsController],
            providers: [
                { provide: WorkstationsService, useValue: workstationsService },
                { provide: WorkstationSessionService, useValue: sessionService },
            ],
        }).compile();

        controller = module.get<WorkstationsController>(WorkstationsController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('findAll', () => {
        it('should return workstations with device status', async () => {
            const result = await controller.findAll();

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('ws-1');
            expect(result[0].code).toBe('WS-001');
            expect(result[0].devices).toHaveLength(1);
            expect(workstationsService.findAllWithDeviceStatus).toHaveBeenCalled();
        });

        it('should return empty array when no workstations', async () => {
            workstationsService.findAllWithDeviceStatus.mockResolvedValue([]);

            const result = await controller.findAll();

            expect(result).toEqual([]);
        });
    });

    describe('findAccessible', () => {
        it('should return accessible workstations with device status for user', async () => {
            const result = await controller.findAccessible(mockUser as any);

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('ws-1');
            expect(workstationsService.getAccessibleWorkstationsWithDeviceStatus).toHaveBeenCalledWith('user-1', ['role-1']);
        });
    });

    describe('getAvailableRoles', () => {
        it('should return available roles from service', async () => {
            const result = await controller.getAvailableRoles();

            expect(result).toEqual([{ id: 'r1', name: 'Admin' }]);
            expect(workstationsService.getAvailableRoles).toHaveBeenCalled();
        });
    });

    describe('findOne', () => {
        it('should return workstation details', async () => {
            const result = await controller.findOne('ws-1');

            expect(result.workstation.id).toBe('ws-1');
            expect(workstationsService.findByIdWithDetails).toHaveBeenCalledWith('ws-1');
        });
    });

    describe('create', () => {
        it('should create a new workstation', async () => {
            const dto = { displayName: 'New WS', code: 'WS-002' };
            const result = await controller.create(dto as any, mockUser as any);

            expect(result.id).toBe('ws-new');
            expect(workstationsService.create).toHaveBeenCalledWith(dto, 'user-1');
        });
    });

    describe('update', () => {
        it('should update a workstation', async () => {
            const dto = { displayName: 'Updated WS' };
            const result = await controller.update('ws-1', dto as any, mockUser as any);

            expect(result.displayName).toBe('Updated WS');
            expect(workstationsService.update).toHaveBeenCalledWith('ws-1', dto, 'user-1');
        });
    });

    describe('remove', () => {
        it('should deactivate a workstation', async () => {
            await controller.remove('ws-1', mockUser as any);

            expect(workstationsService.remove).toHaveBeenCalledWith('ws-1', 'user-1');
        });
    });

    describe('assignUsers', () => {
        it('should assign users to workstation', async () => {
            const dto = { userIds: ['u1', 'u2'] };
            await controller.assignUsers('ws-1', dto as any, mockUser as any);

            expect(workstationsService.assignUsers).toHaveBeenCalledWith('ws-1', ['u1', 'u2'], 'user-1');
        });
    });

    describe('assignRoles', () => {
        it('should assign roles to workstation', async () => {
            const dto = { roleIds: ['r1'] };
            await controller.assignRoles('ws-1', dto as any, mockUser as any);

            expect(workstationsService.assignRoles).toHaveBeenCalledWith('ws-1', ['r1'], 'user-1');
        });
    });

    describe('createEnrollmentToken', () => {
        it('should create enrollment token', async () => {
            const dto = { providerType: 'printer' };
            const result = await controller.createEnrollmentToken('ws-1', dto as any, mockUser as any);

            expect(result.token).toBe('abc123');
            expect(workstationsService.createEnrollmentToken).toHaveBeenCalledWith('ws-1', 'printer', 'user-1');
        });
    });

    describe('bind', () => {
        it('should bind user to workstation and return status', async () => {
            const dto = { workstationId: 'ws-1' };
            const result = await controller.bind(dto as any, mockUser as any);

            expect(sessionService.bindUserToWorkstationWithDeviceStatus).toHaveBeenCalledWith(
                'user-1', 'rest-session', 'ws-1', ['role-1'],
            );
            expect(result.workstationId).toBe('ws-1');
            expect(result.code).toBe('WS-001');
            expect(result.displayName).toBe('WS 01');
            expect(result.devices).toHaveLength(2);
        });

        it('should propagate NotFoundException from session service', async () => {
            sessionService.bindUserToWorkstationWithDeviceStatus.mockRejectedValue(
                new NotFoundException('Workstation not found'),
            );

            const dto = { workstationId: 'ws-999' };
            await expect(controller.bind(dto as any, mockUser as any)).rejects.toThrow(NotFoundException);
        });

        it('should propagate ForbiddenException when user lacks access', async () => {
            sessionService.bindUserToWorkstationWithDeviceStatus.mockRejectedValue(
                new ForbiddenException('User does not have access to this workstation'),
            );

            const dto = { workstationId: 'ws-1' };
            await expect(controller.bind(dto as any, mockUser as any)).rejects.toThrow(ForbiddenException);
        });

        it('should handle empty roleIds', async () => {
            const userNoRoles = { ...mockUser, roleIds: undefined };
            const dto = { workstationId: 'ws-1' };
            await controller.bind(dto as any, userNoRoles as any);

            expect(sessionService.bindUserToWorkstationWithDeviceStatus).toHaveBeenCalledWith(
                'user-1', 'rest-session', 'ws-1', [],
            );
        });
    });

    describe('getCurrentSession', () => {
        it('should return active session with device status', async () => {
            const result = await controller.getCurrentSession(mockUser as any);

            expect(sessionService.getActiveSessionWithDeviceStatus).toHaveBeenCalledWith('user-1', ['role-1']);
            expect(result?.workstationId).toBe('ws-1');
            expect(result?.devices).toHaveLength(2);
        });

        it('should return null when no active session', async () => {
            sessionService.getActiveSessionWithDeviceStatus.mockResolvedValue(null);

            const result = await controller.getCurrentSession(mockUser as any);

            expect(result).toBeNull();
        });
    });
});
