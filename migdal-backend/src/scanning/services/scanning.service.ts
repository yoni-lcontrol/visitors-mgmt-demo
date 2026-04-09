import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DeviceCommandRoutingService, CommandRouteResult } from '../../device-commands/services/device-command-routing.service';
import { IntegrationProvider } from '../../integrations/common/enums/integration-provider.enum';
import { ScannerActionRequestPayload } from '../../websocket/interfaces/ws-payloads.interface';

@Injectable()
export class ScanningService {
    private readonly logger = new Logger(ScanningService.name);

    constructor(
        private readonly commandRouting: DeviceCommandRoutingService,
    ) { }

    async requestScannerAction(
        userId: string,
        userSocketId: string,
        payload: ScannerActionRequestPayload,
    ): Promise<CommandRouteResult> {
        if (!payload.actionType) {
            throw new BadRequestException('actionType is required');
        }

        this.logger.log(
            `Scanner action requested: user=${userId}, action=${payload.actionType}`,
        );

        return this.commandRouting.routeCommand(
            {
                userId,
                providerType: IntegrationProvider.Scanner,
                commandType: payload.actionType,
                requestPayload: {
                    actionType: payload.actionType,
                    metadata: payload.metadata,
                },
            },
            userSocketId,
        );
    }
}
