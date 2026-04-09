import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ScanningService } from './scanning.service';
import { DeviceCommandRoutingService } from '../../device-commands/services/device-command-routing.service';
import { IntegrationProvider } from '../../integrations/common/enums/integration-provider.enum';

describe('ScanningService', () => {
    let service: ScanningService;
    let commandRouting: { routeCommand: jest.Mock };

    beforeEach(async () => {
        commandRouting = { routeCommand: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ScanningService,
                { provide: DeviceCommandRoutingService, useValue: commandRouting },
            ],
        }).compile();

        service = module.get<ScanningService>(ScanningService);
    });

    describe('requestScannerAction', () => {
        it('should route scanner command with correct provider', async () => {
            commandRouting.routeCommand.mockResolvedValue({
                commandLog: { id: 'log-1' },
                agentSocketId: 'agent-1',
                correlationId: 'corr-1',
            });

            const result = await service.requestScannerAction('user-1', 'socket-1', {
                actionType: 'scan-id',
            });

            expect(commandRouting.routeCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    providerType: IntegrationProvider.Scanner,
                    commandType: 'scan-id',
                }),
                'socket-1',
            );
            expect(result.correlationId).toBe('corr-1');
        });

        it('should throw when actionType is missing', async () => {
            await expect(
                service.requestScannerAction('user-1', 'socket-1', { actionType: '' }),
            ).rejects.toThrow(BadRequestException);
        });
    });
});
