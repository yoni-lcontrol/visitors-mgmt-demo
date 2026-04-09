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
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Namespace, Socket } from 'socket.io';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { WorkstationSessionService } from '../../workstations/services/workstation-session.service';
import { AgentRegistryService } from '../../agents/services/agent-registry.service';
import { ScanningService } from '../../scanning/services/scanning.service';
import { WsEvent } from '../enums/ws-events.enum';
import {
    WorkstationBindPayload,
    ScannerActionRequestPayload,
    WorkstationDeviceStatus,
} from '../interfaces/ws-payloads.interface';
import { IntegrationProvider } from '../../integrations/common/enums/integration-provider.enum';
import { PermissionKey } from '../../common/enums/permission-key.enum';

@WebSocketGateway({
    namespace: '/ws/users',
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:4200',
        credentials: true,
    },
})
export class UsersGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server!: Namespace;

    private readonly logger = new Logger(UsersGateway.name);

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly workstationSession: WorkstationSessionService,
        private readonly agentRegistry: AgentRegistryService,
        private readonly scanningService: ScanningService,
    ) { }

    afterInit(): void {
        this.logger.log('Users WebSocket Gateway initialized (/ws/users)');
    }

    handleConnection(client: Socket): void {
        try {
            const token = (client.handshake.auth?.token as string)?.replace('Bearer ', '');
            if (!token) {
                client.disconnect(true);
                return;
            }

            const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
            const payload = this.jwtService.verify<JwtPayload>(token, { secret });
            (client as any).user = payload;

            // Join rooms per contract
            client.join('global');
            client.join(`user:${payload.sub}`);
            if (payload.roles) {
                payload.roles.forEach((role) => client.join(`role:${role}`));
            }

            this.logger.log(`User connected: ${client.id} (user: ${payload.username})`);
        } catch {
            this.logger.warn(`User client ${client.id} failed auth - disconnecting`);
            client.disconnect(true);
        }
    }

    async handleDisconnect(client: Socket): Promise<void> {
        this.logger.log(`User disconnected: ${client.id}`);
        await this.workstationSession.markDisconnected(client.id);
    }

    @SubscribeMessage(WsEvent.WorkstationBindCurrentSession)
    async handleWorkstationBind(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: WorkstationBindPayload,
    ): Promise<void> {
        const user = (client as any).user as JwtPayload | undefined;
        if (!user) {
            client.emit(WsEvent.WorkstationBindFailed, { reason: 'Not authenticated' });
            return;
        }

        if (!payload?.workstationId) {
            client.emit(WsEvent.WorkstationBindFailed, { reason: 'workstationId is required' });
            return;
        }

        try {
            const { session, workstation } = await this.workstationSession.bindUserToWorkstation(
                user.sub,
                client.id,
                payload.workstationId,
                user.roleIds || [],
            );

            // Get current device status for this workstation
            const agents = await this.agentRegistry.findActiveConnectionsByWorkstation(workstation.id);
            const devices: WorkstationDeviceStatus[] = [IntegrationProvider.Printer, IntegrationProvider.Scanner].map(
                (provider) => {
                    const agent = agents.find((a) => a.providerType === provider);
                    return {
                        providerType: provider,
                        isConnected: !!agent,
                        agentVersion: agent?.version ?? null,
                        lastSeenAt: agent?.lastSeenAt ? agent.lastSeenAt.toISOString() : null,
                        capabilities: agent?.capabilitiesJson ? JSON.parse(agent.capabilitiesJson) : null,
                    };
                },
            );

            client.emit(WsEvent.WorkstationBindSuccess, {
                workstationId: workstation.id,
                code: workstation.code,
                displayName: workstation.displayName,
                devices,
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            this.logger.error(`Workstation bind failed for user ${user.sub}: ${message}`);
            client.emit(WsEvent.WorkstationBindFailed, { reason: message });
        }
    }

    @SubscribeMessage(WsEvent.DevicesStatusGetCurrent)
    async handleGetDeviceStatus(
        @ConnectedSocket() client: Socket,
    ): Promise<void> {
        const user = (client as any).user as JwtPayload | undefined;
        if (!user) return;

        const session = await this.workstationSession.getActiveSession(user.sub);
        if (!session) {
            client.emit(WsEvent.DevicesStatusCurrent, { devices: [] });
            return;
        }

        const agents = await this.agentRegistry.findActiveConnectionsByWorkstation(session.workstationId);
        const devices: WorkstationDeviceStatus[] = [IntegrationProvider.Printer, IntegrationProvider.Scanner].map(
            (provider) => {
                const agent = agents.find((a) => a.providerType === provider);
                return {
                    providerType: provider,
                    isConnected: !!agent,
                    agentVersion: agent?.version ?? null,
                    lastSeenAt: agent?.lastSeenAt ? agent.lastSeenAt.toISOString() : null,
                    capabilities: agent?.capabilitiesJson ? JSON.parse(agent.capabilitiesJson) : null,
                };
            },
        );

        client.emit(WsEvent.DevicesStatusCurrent, { devices });
    }

    @SubscribeMessage(WsEvent.ScannerActionRequest)
    async handleScannerRequest(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: ScannerActionRequestPayload,
    ): Promise<void> {
        const user = (client as any).user as JwtPayload | undefined;
        if (!user) return;

        if (!user.permissions?.includes(PermissionKey.ScannerExecute)) {
            client.emit(WsEvent.ScannerActionFailed, {
                reason: 'Permission denied: scanner.execute required',
                correlationId: '',
            });
            return;
        }

        try {
            const routeResult = await this.scanningService.requestScannerAction(
                user.sub,
                client.id,
                payload,
            );

            this.emitToAgentNamespace(routeResult.agentSocketId, WsEvent.AgentExecuteScan, {
                correlationId: routeResult.correlationId,
                actionType: payload.actionType,
                metadata: payload.metadata,
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            client.emit(WsEvent.ScannerActionFailed, { reason: message, correlationId: '' });
        }
    }

    /**
     * Broadcast an event to a specific room (preserves existing API).
     */
    broadcastToRoom(room: string, event: string, data: unknown): void {
        this.server.to(room).emit(event, data);
    }

    /**
     * Broadcast an event to all connected user clients.
     */
    broadcastToAll(event: string, data: unknown): void {
        this.server.emit(event, data);
    }

    /**
     * Emit directly to a specific user socket.
     */
    emitToSocket(socketId: string, event: string, data: unknown): void {
        this.server.to(socketId).emit(event, data);
    }

    /**
     * Send command to the agent gateway namespace.
     * The AgentsGateway must be accessible; we emit via the cross-namespace approach.
     */
    emitToAgentNamespace(agentSocketId: string, event: string, data: unknown): void {
        // socket.io allows cross-namespace emission by accessing the server root
        const agentNamespace = this.server.server?.of('/ws/agents');
        if (agentNamespace) {
            agentNamespace.to(agentSocketId).emit(event, data);
        } else {
            this.logger.warn('Agent namespace not available for cross-namespace emission');
        }
    }
}
