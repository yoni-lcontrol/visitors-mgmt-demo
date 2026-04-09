import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { AgentRegistryService } from './agent-registry.service';
import { DeviceAgent } from '../entities/device-agent.entity';
import { Workstation } from '../../workstations/entities/workstation.entity';
import { IntegrationProvider } from '../../integrations/common/enums/integration-provider.enum';
import { createMockRepository } from '../../test-utils/mock.factory';

describe('AgentRegistryService', () => {
    let service: AgentRegistryService;
    let deviceAgentRepo: ReturnType<typeof createMockRepository>;
    let workstationRepo: ReturnType<typeof createMockRepository>;

    beforeEach(async () => {
        deviceAgentRepo = createMockRepository();
        workstationRepo = createMockRepository();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AgentRegistryService,
                { provide: getRepositoryToken(DeviceAgent), useValue: deviceAgentRepo },
                { provide: getRepositoryToken(Workstation), useValue: workstationRepo },
            ],
        }).compile();

        service = module.get<AgentRegistryService>(AgentRegistryService);
    });

    describe('registerAgent', () => {
        const payload = {
            clientId: 'printer-agent-1',
            timestamp: Date.now(),
            signature: 'any',
            providerType: IntegrationProvider.Printer,
            machineId: 'machine-1',
            hostname: 'ws-01',
            version: '1.0.0',
            capabilities: ['card-print'],
        };

        it('should register agent and update connection state on DeviceAgent', async () => {
            const deviceAgent = { id: 'agent-id', clientId: 'printer-agent-1', workstationId: 'ws-id', isEnabled: true, version: '0.9', isConnected: false, socketId: null };
            const workstation = { id: 'ws-id', machineId: 'machine-1', hostname: 'ws-01', isActive: true };

            deviceAgentRepo.findOne.mockResolvedValue(deviceAgent);
            workstationRepo.findOne.mockResolvedValue(workstation);
            deviceAgentRepo.save.mockResolvedValue({ ...deviceAgent, version: '1.0.0', isConnected: true, socketId: 'socket-123' });

            const result = await service.registerAgent(payload, 'socket-123');

            expect(result.workstationId).toBe('ws-id');
            expect(result.deviceAgent).toBeDefined();
            expect(deviceAgentRepo.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    version: '1.0.0',
                    isConnected: true,
                    socketId: 'socket-123',
                }),
            );
        });

        it('should stamp machineId/hostname on workstation if not set', async () => {
            const deviceAgent = { id: 'agent-id', clientId: 'printer-agent-1', workstationId: 'ws-id', isEnabled: true, version: '1.0.0', isConnected: false, socketId: null };
            const workstation = { id: 'ws-id', machineId: null, hostname: null, isActive: true };

            deviceAgentRepo.findOne.mockResolvedValue(deviceAgent);
            workstationRepo.findOne.mockResolvedValue(workstation);
            deviceAgentRepo.save.mockResolvedValue({ ...deviceAgent, isConnected: true });

            await service.registerAgent(payload, 'socket-456');

            expect(workstationRepo.save).toHaveBeenCalledWith(
                expect.objectContaining({ machineId: 'machine-1', hostname: 'ws-01' }),
            );
        });

        it('should not overwrite existing machineId/hostname', async () => {
            const deviceAgent = { id: 'agent-id', clientId: 'printer-agent-1', workstationId: 'ws-id', isEnabled: true, version: '1.0.0', isConnected: false, socketId: null };
            const workstation = { id: 'ws-id', machineId: 'existing-machine', hostname: 'existing-host', isActive: true };

            deviceAgentRepo.findOne.mockResolvedValue(deviceAgent);
            workstationRepo.findOne.mockResolvedValue(workstation);
            deviceAgentRepo.save.mockResolvedValue({ ...deviceAgent, isConnected: true });

            await service.registerAgent(payload, 'socket-789');

            // workstationRepo.save should not be called because machineId and hostname already set
            expect(workstationRepo.save).not.toHaveBeenCalled();
        });

        it('should throw if device agent not found', async () => {
            deviceAgentRepo.findOne.mockResolvedValue(null);

            await expect(service.registerAgent(payload, 'socket-789')).rejects.toThrow(NotFoundException);
        });

        it('should throw if workstation not found for agent', async () => {
            deviceAgentRepo.findOne.mockResolvedValue({ id: 'agent-id', clientId: 'printer-agent-1', workstationId: 'ws-id', isEnabled: true });
            workstationRepo.findOne.mockResolvedValue(null);

            await expect(service.registerAgent(payload, 'socket-789')).rejects.toThrow(NotFoundException);
        });

        it('should set capabilities from payload', async () => {
            const deviceAgent = { id: 'agent-id', clientId: 'printer-agent-1', workstationId: 'ws-id', isEnabled: true, version: '1.0.0', isConnected: false, socketId: null };
            const workstation = { id: 'ws-id', machineId: 'm1', hostname: 'h1', isActive: true };

            deviceAgentRepo.findOne.mockResolvedValue(deviceAgent);
            workstationRepo.findOne.mockResolvedValue(workstation);
            deviceAgentRepo.save.mockResolvedValue({ ...deviceAgent, isConnected: true });

            await service.registerAgent(payload, 'socket-cap');

            expect(deviceAgentRepo.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    capabilitiesJson: JSON.stringify(['card-print']),
                }),
            );
        });
    });

    describe('markDisconnected', () => {
        it('should mark agent as disconnected and clear socketId', async () => {
            const agent = {
                id: 'agent-id',
                socketId: 'socket-1',
                isConnected: true,
                workstationId: 'ws-1',
                providerType: IntegrationProvider.Printer,
            };
            deviceAgentRepo.findOne.mockResolvedValue(agent);
            deviceAgentRepo.save.mockResolvedValue({ ...agent, isConnected: false, socketId: null });

            const result = await service.markDisconnected('socket-1');

            expect(result).toBeDefined();
            expect(deviceAgentRepo.save).toHaveBeenCalledWith(expect.objectContaining({
                isConnected: false,
                socketId: null,
            }));
        });

        it('should return null if no connected agent with that socket', async () => {
            deviceAgentRepo.findOne.mockResolvedValue(null);
            const result = await service.markDisconnected('unknown-socket');
            expect(result).toBeNull();
        });
    });

    describe('findActiveConnection', () => {
        it('should find active connected agent for workstation', async () => {
            const agent = { id: 'agent-1', workstationId: 'ws-1', providerType: IntegrationProvider.Printer, isConnected: true };
            deviceAgentRepo.findOne.mockResolvedValue(agent);

            const result = await service.findActiveConnection('ws-1', IntegrationProvider.Printer);
            expect(result).toEqual(agent);
        });

        it('should return null when no connected agent', async () => {
            deviceAgentRepo.findOne.mockResolvedValue(null);
            const result = await service.findActiveConnection('ws-1', IntegrationProvider.Scanner);
            expect(result).toBeNull();
        });
    });

    describe('updateHeartbeat', () => {
        it('should update lastSeenAt on the connected agent', async () => {
            await service.updateHeartbeat('socket-1');
            expect(deviceAgentRepo.update).toHaveBeenCalledWith(
                { socketId: 'socket-1', isConnected: true },
                expect.objectContaining({ lastSeenAt: expect.any(Date) }),
            );
        });
    });

    describe('findActiveConnectionsByWorkstation', () => {
        it('should return all connected agents for workstation', async () => {
            const agents = [
                { id: 'a1', workstationId: 'ws-1', providerType: IntegrationProvider.Printer, isConnected: true },
                { id: 'a2', workstationId: 'ws-1', providerType: IntegrationProvider.Scanner, isConnected: true },
            ];
            deviceAgentRepo.find.mockResolvedValue(agents);

            const result = await service.findActiveConnectionsByWorkstation('ws-1');
            expect(result).toHaveLength(2);
        });
    });

    describe('enrollAgent', () => {
        it('should deactivate old agents and create new one', async () => {
            deviceAgentRepo.create.mockReturnValue({ id: 'new-agent', clientId: 'new-client' });
            deviceAgentRepo.save.mockResolvedValue({ id: 'new-agent', clientId: 'new-client' });

            const result = await service.enrollAgent('ws-1', 'printer', 'new-client', 'secret');

            expect(deviceAgentRepo.update).toHaveBeenCalledWith(
                expect.objectContaining({ workstationId: 'ws-1', isActive: true }),
                expect.objectContaining({ isActive: false, isEnabled: false }),
            );
            expect(result.id).toBe('new-agent');
        });
    });
});
