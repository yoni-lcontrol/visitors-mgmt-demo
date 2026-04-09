import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WorkstationSessionService } from './workstation-session.service';
import { UserWorkstationSession } from '../entities/user-workstation-session.entity';
import { Workstation } from '../entities/workstation.entity';
import { WorkstationUser } from '../entities/workstation-user.entity';
import { WorkstationRole } from '../entities/workstation-role.entity';
import { DeviceAgent } from '../../agents/entities/device-agent.entity';
import { createMockRepository } from '../../test-utils/mock.factory';

describe('WorkstationSessionService', () => {
    let service: WorkstationSessionService;
    let sessionRepo: ReturnType<typeof createMockRepository>;
    let workstationRepo: ReturnType<typeof createMockRepository>;
    let deviceAgentRepo: ReturnType<typeof createMockRepository>;
    let workstationUserRepo: ReturnType<typeof createMockRepository>;
    let workstationRoleRepo: ReturnType<typeof createMockRepository>;

    beforeEach(async () => {
        sessionRepo = createMockRepository();
        workstationRepo = createMockRepository();
        deviceAgentRepo = createMockRepository();
        workstationUserRepo = createMockRepository();
        workstationRoleRepo = createMockRepository();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WorkstationSessionService,
                { provide: getRepositoryToken(UserWorkstationSession), useValue: sessionRepo },
                { provide: getRepositoryToken(Workstation), useValue: workstationRepo },
                { provide: getRepositoryToken(DeviceAgent), useValue: deviceAgentRepo },
                { provide: getRepositoryToken(WorkstationUser), useValue: workstationUserRepo },
                { provide: getRepositoryToken(WorkstationRole), useValue: workstationRoleRepo },
            ],
        }).compile();

        service = module.get<WorkstationSessionService>(WorkstationSessionService);
    });

    describe('bindUserToWorkstation', () => {
        it('should create session when user has direct access', async () => {
            const ws = { id: 'ws-1', code: 'WS-01', displayName: 'WS 01', isActive: true };
            workstationRepo.findOne.mockResolvedValue(ws);
            workstationUserRepo.findOne.mockResolvedValue({ id: 'wu-1' }); // user has access
            sessionRepo.create.mockReturnValue({ userId: 'u1', workstationId: 'ws-1' });
            sessionRepo.save.mockResolvedValue({ id: 'sess-1', userId: 'u1', workstationId: 'ws-1' });

            const result = await service.bindUserToWorkstation('u1', 'socket-1', 'ws-1', []);

            expect(result.workstation).toEqual(ws);
            expect(sessionRepo.update).toHaveBeenCalled();
            expect(sessionRepo.save).toHaveBeenCalled();
        });

        it('should throw NotFoundException when workstation not found', async () => {
            workstationRepo.findOne.mockResolvedValue(null);

            await expect(
                service.bindUserToWorkstation('u1', 'socket-1', 'ws-bad', []),
            ).rejects.toThrow('Workstation not found');
        });

        it('should throw ForbiddenException when user has no access', async () => {
            const ws = { id: 'ws-1', code: 'WS-01', isActive: true };
            workstationRepo.findOne.mockResolvedValue(ws);
            workstationUserRepo.findOne.mockResolvedValue(null); // no direct access
            workstationRoleRepo.findOne.mockResolvedValue(null); // no role access

            await expect(
                service.bindUserToWorkstation('u1', 'socket-1', 'ws-1', ['role-1']),
            ).rejects.toThrow('User does not have access to this workstation');
        });

        it('should allow access via role assignment', async () => {
            const ws = { id: 'ws-1', code: 'WS-01', isActive: true };
            workstationRepo.findOne.mockResolvedValue(ws);
            workstationUserRepo.findOne.mockResolvedValue(null); // no direct
            workstationRoleRepo.findOne.mockResolvedValue({ id: 'wr-1' }); // role access
            sessionRepo.create.mockReturnValue({ userId: 'u1' });
            sessionRepo.save.mockResolvedValue({ id: 'sess-1' });

            const result = await service.bindUserToWorkstation('u1', 'socket-1', 'ws-1', ['role-1']);

            expect(result.workstation).toEqual(ws);
        });
    });

    describe('getActiveSession', () => {
        it('should return active session', async () => {
            const session = { id: 'sess-1', userId: 'u1', isActive: true };
            sessionRepo.findOne.mockResolvedValue(session);

            const result = await service.getActiveSession('u1');
            expect(result).toEqual(session);
        });

        it('should return null when no active session', async () => {
            sessionRepo.findOne.mockResolvedValue(null);
            const result = await service.getActiveSession('u1');
            expect(result).toBeNull();
        });
    });

    describe('markDisconnected', () => {
        it('should deactivate session by socket id', async () => {
            await service.markDisconnected('socket-1');
            expect(sessionRepo.update).toHaveBeenCalledWith(
                { userSocketId: 'socket-1', isActive: true },
                expect.objectContaining({ isActive: false, disconnectedAt: expect.any(Date) }),
            );
        });
    });

    describe('findActiveSessionsByWorkstation', () => {
        it('should return active sessions for workstation', async () => {
            const sessions = [
                { id: 's1', userId: 'u1', workstationId: 'ws-1', isActive: true },
                { id: 's2', userId: 'u2', workstationId: 'ws-1', isActive: true },
            ];
            sessionRepo.find.mockResolvedValue(sessions);

            const result = await service.findActiveSessionsByWorkstation('ws-1');

            expect(result).toEqual(sessions);
            expect(sessionRepo.find).toHaveBeenCalledWith({
                where: { workstationId: 'ws-1', isActive: true },
            });
        });

        it('should return empty array when no active sessions', async () => {
            sessionRepo.find.mockResolvedValue([]);

            const result = await service.findActiveSessionsByWorkstation('ws-99');

            expect(result).toEqual([]);
        });
    });

    describe('findAllWithDeviceStatus', () => {
        it('should return workstations with connected device info', async () => {
            workstationRepo.find.mockResolvedValue([
                { id: 'ws-1', code: 'WS-01', displayName: 'WS 01', machineId: 'm1', hostname: 'host1' },
                { id: 'ws-2', code: 'WS-02', displayName: 'WS 02', machineId: null, hostname: null },
            ]);
            deviceAgentRepo.find.mockResolvedValue([
                { workstationId: 'ws-1', providerType: 'printer', isConnected: true, isActive: true, deviceConnected: true },
                { workstationId: 'ws-1', providerType: 'scanner', isConnected: true, isActive: true, deviceConnected: null },
            ]);

            const result = await service.findAllWithDeviceStatus();

            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('ws-1');
            expect(result[0].code).toBe('WS-01');
            expect(result[0].displayName).toBe('WS 01');
            expect(result[0].devices).toHaveLength(2);
            expect(result[0].devices[0]).toEqual({ providerType: 'printer', isConnected: true, deviceConnected: true });
            expect(result[0].devices[1]).toEqual({ providerType: 'scanner', isConnected: true, deviceConnected: null });
            expect(result[1].id).toBe('ws-2');
            expect(result[1].devices).toHaveLength(0);
        });

        it('should return empty array when no workstations exist', async () => {
            workstationRepo.find.mockResolvedValue([]);
            deviceAgentRepo.find.mockResolvedValue([]);

            const result = await service.findAllWithDeviceStatus();

            expect(result).toEqual([]);
        });

        it('should query only active connected agents', async () => {
            workstationRepo.find.mockResolvedValue([]);
            deviceAgentRepo.find.mockResolvedValue([]);

            await service.findAllWithDeviceStatus();

            expect(deviceAgentRepo.find).toHaveBeenCalledWith({
                where: { isConnected: true, isActive: true, isEnabled: true },
            });
        });

        it('should query only active workstations sorted by hostname', async () => {
            workstationRepo.find.mockResolvedValue([]);
            deviceAgentRepo.find.mockResolvedValue([]);

            await service.findAllWithDeviceStatus();

            expect(workstationRepo.find).toHaveBeenCalledWith({
                where: { isActive: true },
                order: { displayName: 'ASC' },
            });
        });
    });

    describe('getActiveSessionWithDeviceStatus', () => {
        it('should return session with device status when session exists and user has access', async () => {
            const ws = { id: 'ws-1', code: 'WS-01', displayName: 'WS 01' };
            sessionRepo.findOne.mockResolvedValue({ id: 'sess-1', userId: 'u1', workstationId: 'ws-1', workstation: ws });
            workstationUserRepo.findOne.mockResolvedValue({ id: 'wu-1' }); // user has access
            deviceAgentRepo.find.mockResolvedValue([
                {
                    workstationId: 'ws-1',
                    providerType: 'printer',
                    isConnected: true,
                    deviceConnected: true,
                    isActive: true,
                    version: '1.0',
                    lastSeenAt: new Date('2026-04-04T12:00:00Z'),
                    capabilitiesJson: '["card-print"]',
                },
            ]);

            const result = await service.getActiveSessionWithDeviceStatus('u1', []);

            expect(result).not.toBeNull();
            expect(result!.workstationId).toBe('ws-1');
            expect(result!.code).toBe('WS-01');
            expect(result!.devices).toHaveLength(2);
            const printerDevice = result!.devices.find((d) => d.providerType === 'printer')!;
            expect(printerDevice.isConnected).toBe(true);
            expect(printerDevice.deviceConnected).toBe(true);
            expect(printerDevice.capabilities).toEqual(['card-print']);
            const scannerDevice = result!.devices.find((d) => d.providerType === 'scanner')!;
            expect(scannerDevice.isConnected).toBe(false);
            expect(scannerDevice.deviceConnected).toBeNull();
        });

        it('should return null when no active session', async () => {
            sessionRepo.findOne.mockResolvedValue(null);

            const result = await service.getActiveSessionWithDeviceStatus('u1', []);

            expect(result).toBeNull();
        });

        it('should return null and deactivate session when user no longer has access', async () => {
            const ws = { id: 'ws-1', code: 'WS-01', displayName: 'WS 01' };
            sessionRepo.findOne.mockResolvedValue({ id: 'sess-1', userId: 'u1', workstationId: 'ws-1', workstation: ws });
            workstationUserRepo.findOne.mockResolvedValue(null); // no direct access
            workstationRoleRepo.findOne.mockResolvedValue(null); // no role access

            const result = await service.getActiveSessionWithDeviceStatus('u1', ['role-1']);

            expect(result).toBeNull();
            expect(sessionRepo.update).toHaveBeenCalledWith('sess-1', expect.objectContaining({ isActive: false }));
        });

        it('should return all devices disconnected when no agent connections', async () => {
            const ws = { id: 'ws-1', code: 'WS-01', displayName: 'WS 01' };
            sessionRepo.findOne.mockResolvedValue({ id: 'sess-1', userId: 'u1', workstationId: 'ws-1', workstation: ws });
            workstationUserRepo.findOne.mockResolvedValue({ id: 'wu-1' }); // user has access
            deviceAgentRepo.find.mockResolvedValue([]);

            const result = await service.getActiveSessionWithDeviceStatus('u1', []);

            expect(result).not.toBeNull();
            expect(result!.devices.every((d) => !d.isConnected)).toBe(true);
            expect(result!.devices.every((d) => d.deviceConnected === null)).toBe(true);
        });
    });
});
