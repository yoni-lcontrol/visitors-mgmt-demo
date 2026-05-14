import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Namespace, Socket } from 'socket.io';
import { AgentRegistryService } from '../../agents/services/agent-registry.service';
import { DeviceCommandRoutingService } from '../../device-commands/services/device-command-routing.service';
import { WorkstationsService } from '../../workstations/services/workstations.service';
import { IntegrationProvider } from '../../integrations/common/enums/integration-provider.enum';
import { WsEvent } from '../enums/ws-events.enum';
import {
    KioskRegisterPayload,
    KioskRequestScanPayload,
} from '../interfaces/ws-payloads.interface';

@WebSocketGateway({
    namespace: '/ws/kiosk',
    cors: {
        origin: '*',
    },
})
export class KioskGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server!: Namespace;

    private readonly logger = new Logger(KioskGateway.name);
    private readonly kioskApiKey: string;

    constructor(
        private readonly configService: ConfigService,
        private readonly agentRegistry: AgentRegistryService,
        private readonly commandRouting: DeviceCommandRoutingService,
        private readonly workstationsService: WorkstationsService,
    ) {
        this.kioskApiKey = this.configService.get<string>('KIOSK_API_KEY', 'kiosk-dev-key');
    }

    afterInit(): void {
        this.logger.log('Kiosk WebSocket Gateway initialized (/ws/kiosk)');
    }

    handleConnection(client: Socket): void {
        const apiKey = client.handshake?.auth?.apiKey;

        if (!apiKey || apiKey !== this.kioskApiKey) {
            this.logger.warn(`Kiosk socket ${client.id} rejected: invalid API key`);
            client.emit(WsEvent.KioskError, { reason: 'Invalid API key' });
            client.disconnect(true);
            return;
        }

        this.logger.log(`Kiosk socket connected: ${client.id} (pending registration)`);

        // Set a registration timeout
        const registrationTimeout = setTimeout(() => {
            if (!(client as any).kioskRegistered) {
                this.logger.warn(`Kiosk ${client.id} did not register within timeout — disconnecting`);
                client.disconnect(true);
            }
        }, 15_000);

        (client as any)._registrationTimeout = registrationTimeout;
    }

    handleDisconnect(client: Socket): void {
        const timeout = (client as any)._registrationTimeout;
        if (timeout) clearTimeout(timeout);

        const kioskId = (client as any).kioskId;
        const workstationId = (client as any).workstationId;
        this.logger.log(
            `Kiosk socket disconnected: ${client.id} (kiosk=${kioskId}, workstation=${workstationId})`,
        );
    }

    @SubscribeMessage(WsEvent.KioskRegister)
    async handleKioskRegister(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: KioskRegisterPayload,
    ): Promise<void> {
        if (!payload?.kioskId || !payload?.workstationCode) {
            client.emit(WsEvent.KioskError, { reason: 'Missing kioskId or workstationCode' });
            client.disconnect(true);
            return;
        }

        try {
            // Verify the workstation exists (look up by code)
            const workstation = await this.workstationsService.findByCode(payload.workstationCode);
            if (!workstation) {
                this.logger.warn(`Kiosk ${payload.kioskId} tried to register on unknown workstation ${payload.workstationCode}`);
                client.emit(WsEvent.KioskError, { reason: 'Unknown workstation' });
                client.disconnect(true);
                return;
            }

            const workstationId = workstation.id;

            // Mark as registered
            (client as any).kioskRegistered = true;
            (client as any).kioskId = payload.kioskId;
            (client as any).workstationId = workstationId;

            // Clear registration timeout
            const timeout = (client as any)._registrationTimeout;
            if (timeout) clearTimeout(timeout);

            // Join workstation room using the UUID (matches agent room names)
            client.join(`workstation:${workstationId}`);

            client.emit(WsEvent.KioskRegistered, {
                kioskId: payload.kioskId,
                workstationCode: workstation.code,
            });

            this.logger.log(
                `Kiosk registered: ${payload.kioskId} on workstation ${workstation.code} (${workstationId})`,
            );
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Registration failed';
            this.logger.error(`Kiosk registration failed: ${message}`);
            client.emit(WsEvent.KioskError, { reason: message });
            client.disconnect(true);
        }
    }

    @SubscribeMessage(WsEvent.KioskCheckScanner)
    async handleCheckScanner(
        @ConnectedSocket() client: Socket,
    ): Promise<void> {
        if (!(client as any).kioskRegistered) {
            client.emit(WsEvent.KioskError, { reason: 'Not registered' });
            return;
        }

        const workstationId = (client as any).workstationId as string;

        try {
            const agent = await this.agentRegistry.findActiveConnection(
                workstationId,
                IntegrationProvider.Scanner,
            );
            client.emit(WsEvent.KioskScannerStatus, {
                connected: !!agent && !!agent.socketId,
                deviceConnected: !!agent?.deviceConnected,
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to check scanner status';
            this.logger.error(`Scanner status check failed: ${message}`);
            client.emit(WsEvent.KioskScannerStatus, {
                connected: false,
                deviceConnected: false,
            });
        }
    }

    @SubscribeMessage(WsEvent.KioskRequestScan)
    async handleRequestScan(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: KioskRequestScanPayload,
    ): Promise<void> {
        if (!(client as any).kioskRegistered) {
            client.emit(WsEvent.KioskError, { reason: 'Not registered' });
            return;
        }

        const workstationId = (client as any).workstationId as string;

        try {
            // Find active scanner agent on this workstation
            const agent = await this.agentRegistry.findActiveConnection(workstationId, IntegrationProvider.Scanner);
            if (!agent || !agent.socketId) {
                client.emit(WsEvent.KioskError, { reason: 'No scanner agent connected on this workstation' });
                return;
            }

            // Send scan command to the agent via the agents namespace
            const correlationId = `kiosk-scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const agentNs = this.server.server?.of('/ws/agents');
            if (agentNs) {
                agentNs.to(agent.socketId).emit(WsEvent.AgentExecuteScan, {
                    correlationId,
                    actionType: 'scan',
                });
            }

            this.logger.log(
                `Kiosk ${(client as any).kioskId} requested scan on workstation ${workstationId} (correlationId=${correlationId})`,
            );
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Scan request failed';
            this.logger.error(`Kiosk scan request failed: ${message}`);
            client.emit(WsEvent.KioskError, { reason: message });
        }
    }

    /**
     * Emit scan result to all kiosks on a given workstation room.
     * Called from AgentsGateway when a scanner command result arrives.
     */
    emitScanResultToWorkstation(workstationId: string, data: unknown): void {
        this.server.to(`workstation:${workstationId}`).emit(WsEvent.KioskScanResult, data);
    }

    /**
     * Emit scan status to all kiosks on a given workstation room.
     */
    emitScanStatusToWorkstation(workstationId: string, data: unknown): void {
        this.server.to(`workstation:${workstationId}`).emit(WsEvent.KioskScanStatus, data);
    }
}
