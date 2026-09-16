import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { DeviceCommandRoutingService } from './device-command-routing.service';
import { DeviceCommandLog } from '../entities/device-command-log.entity';
import { DeviceCommandStatus } from '../enums/device-command-status.enum';
import { AgentRegistryService } from '../../agents/services/agent-registry.service';
import { WorkstationSessionService } from '../../workstations/services/workstation-session.service';
import { IntegrationProvider } from '../../integrations/common/enums/integration-provider.enum';
import { createMockRepository } from '../../test-utils/mock.factory';

describe('DeviceCommandRoutingService', () => {
    let service: DeviceCommandRoutingService;
    let commandLogRepo: ReturnType<typeof createMockRepository>;
    let agentRegistry: { findActiveConnection: jest.Mock; findActiveConnectionsByWorkstation: jest.Mock };
    let workstationSession: { getActiveSession: jest.Mock };

    beforeEach(async () => {
        commandLogRepo = createMockRepository();
        agentRegistry = {
            findActiveConnection: jest.fn(),
            findActiveConnectionsByWorkstation: jest.fn(),
        };
        workstationSession = { getActiveSession: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DeviceCommandRoutingService,
                { provide: getRepositoryToken(DeviceCommandLog), useValue: commandLogRepo },
                { provide: AgentRegistryService, useValue: agentRegistry },
                { provide: WorkstationSessionService, useValue: workstationSession },
            ],
        }).compile();

        service = module.get<DeviceCommandRoutingService>(DeviceCommandRoutingService);
    });

    describe('routeCommand', () => {
        it('should route command to correct agent', async () => {
            workstationSession.getActiveSession.mockResolvedValue({ workstationId: 'ws-1' });
            agentRegistry.findActiveConnection.mockResolvedValue({
                id: 'device-1',
                socketId: 'agent-socket-1',
            });
            commandLogRepo.create.mockReturnValue({ correlationId: 'corr-1' });
            commandLogRepo.save.mockResolvedValue({ id: 'log-1', correlationId: 'corr-1' });

            const result = await service.routeCommand(
                {
                    userId: 'user-1',
                    providerType: IntegrationProvider.Printer,
                    commandType: 'print-card',
                    requestPayload: { visitId: 'v1' },
                },
                'user-socket-1',
            );

            expect(result.agentSocketId).toBe('agent-socket-1');
            expect(result.correlationId).toBeDefined();
            expect(commandLogRepo.save).toHaveBeenCalled();
        });

        it('should throw when user has no active workstation', async () => {
            workstationSession.getActiveSession.mockResolvedValue(null);

            await expect(
                service.routeCommand(
                    {
                        userId: 'user-1',
                        providerType: IntegrationProvider.Printer,
                        commandType: 'print-card',
                        requestPayload: {},
                    },
                    'user-socket-1',
                ),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw when no agent available for workstation', async () => {
            workstationSession.getActiveSession.mockResolvedValue({ workstationId: 'ws-1' });
            agentRegistry.findActiveConnection.mockResolvedValue(null);

            await expect(
                service.routeCommand(
                    {
                        userId: 'user-1',
                        providerType: IntegrationProvider.Printer,
                        commandType: 'print-card',
                        requestPayload: {},
                    },
                    'user-socket-1',
                ),
            ).rejects.toThrow(ServiceUnavailableException);
        });
    });

    describe('handleCommandAck', () => {
        it('should update status to acknowledged', async () => {
            await service.handleCommandAck('corr-1');
            expect(commandLogRepo.update).toHaveBeenCalledWith(
                { correlationId: 'corr-1' },
                { status: DeviceCommandStatus.Acknowledged },
            );
        });
    });

    describe('handleCommandResult', () => {
        it('should update log on success and return user info', async () => {
            // First route a command to populate pending map
            workstationSession.getActiveSession.mockResolvedValue({ workstationId: 'ws-1' });
            agentRegistry.findActiveConnection.mockResolvedValue({
                socketId: 'agent-socket-1',
                id: 'device-1',
            });
            commandLogRepo.create.mockReturnValue({ correlationId: 'corr-1' });
            commandLogRepo.save.mockResolvedValue({ id: 'log-1', correlationId: 'corr-1' });

            const routeResult = await service.routeCommand(
                {
                    userId: 'user-1',
                    providerType: IntegrationProvider.Printer,
                    commandType: 'print-card',
                    requestPayload: {},
                },
                'user-socket-1',
            );

            const userInfo = await service.handleCommandResult(
                routeResult.correlationId,
                true,
                { printed: true },
            );

            expect(userInfo).toBeDefined();
            expect(userInfo?.userId).toBe('user-1');
            expect(userInfo?.providerType).toBe(IntegrationProvider.Printer);
            expect(userInfo?.commandType).toBe('print-card');
            expect(commandLogRepo.update).toHaveBeenCalledWith(
                { correlationId: routeResult.correlationId },
                expect.objectContaining({ status: DeviceCommandStatus.Completed }),
            );
        });

        it('should update log on failure', async () => {
            const userInfo = await service.handleCommandResult('unknown-corr', false, undefined, 'Agent error');
            expect(userInfo).toBeNull(); // no pending command
            expect(commandLogRepo.update).toHaveBeenCalledWith(
                { correlationId: 'unknown-corr' },
                expect.objectContaining({ status: DeviceCommandStatus.Failed, errorMessage: 'Agent error' }),
            );
        });
    });

    describe('routeKioskCommand', () => {
        it('should route without a user session and log a null requester', async () => {
            agentRegistry.findActiveConnection.mockResolvedValue({
                id: 'device-1',
                socketId: 'printer-socket-1',
            });
            commandLogRepo.save.mockResolvedValue({ id: 'log-1' });

            const result = await service.routeKioskCommand({
                workstationId: 'ws-1',
                providerType: IntegrationProvider.Printer,
                commandType: 'print-card',
                requestPayload: { source: 'kiosk' },
            });

            expect(workstationSession.getActiveSession).not.toHaveBeenCalled();
            expect(result.agentSocketId).toBe('printer-socket-1');
            expect(commandLogRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({ requestedByUserId: null, workstationId: 'ws-1' }),
            );
            expect(service.getPendingCommand(result.correlationId)?.origin).toBe('kiosk');
        });

        it('should throw when no agent is connected for the workstation', async () => {
            agentRegistry.findActiveConnection.mockResolvedValue(null);

            await expect(
                service.routeKioskCommand({
                    workstationId: 'ws-1',
                    providerType: IntegrationProvider.Printer,
                    commandType: 'print-card',
                    requestPayload: {},
                }),
            ).rejects.toThrow(ServiceUnavailableException);
        });
    });

    describe('handleAgentDisconnect', () => {
        it('should only fail commands dispatched to the disconnected agent socket', async () => {
            commandLogRepo.save.mockResolvedValue({ id: 'log-1' });

            agentRegistry.findActiveConnection.mockResolvedValue({ id: 'd1', socketId: 'socket-a' });
            const onSocketA = await service.routeKioskCommand({
                workstationId: 'ws-1',
                providerType: IntegrationProvider.Printer,
                commandType: 'print-card',
                requestPayload: {},
            });

            agentRegistry.findActiveConnection.mockResolvedValue({ id: 'd2', socketId: 'socket-b' });
            const onSocketB = await service.routeKioskCommand({
                workstationId: 'ws-2',
                providerType: IntegrationProvider.Scanner,
                commandType: 'scan',
                requestPayload: {},
            });

            const failed = await service.handleAgentDisconnect('socket-a');

            expect(failed).toHaveLength(1);
            expect(failed[0].correlationId).toBe(onSocketA.correlationId);
            expect(failed[0].workstationId).toBe('ws-1');
            expect(service.getPendingCommand(onSocketA.correlationId)).toBeUndefined();
            // The unrelated agent's command must survive
            expect(service.getPendingCommand(onSocketB.correlationId)).toBeDefined();

            // Settle it so its timeout handle doesn't outlive the test
            await service.handleCommandResult(onSocketB.correlationId, true);
        });

        it('should return an empty list when no command targeted that socket', async () => {
            const failed = await service.handleAgentDisconnect('unknown-socket');
            expect(failed).toEqual([]);
        });
    });
});
