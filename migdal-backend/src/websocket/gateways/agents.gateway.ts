import * as crypto from 'crypto';
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
import { Namespace, Socket } from 'socket.io';
import { AgentHmacAuthService } from '../../agents/services/agent-hmac-auth.service';
import { AgentRegistryService } from '../../agents/services/agent-registry.service';
import { DeviceCommandRoutingService } from '../../device-commands/services/device-command-routing.service';
import { WorkstationSessionService } from '../../workstations/services/workstation-session.service';
import { WorkstationsService } from '../../workstations/services/workstations.service';
import { WsEvent } from '../enums/ws-events.enum';
import {
    AgentRegisterPayload,
    AgentEnrollPayload,
    AgentHeartbeatPayload,
    AgentCommandAckPayload,
    AgentCommandResultPayload,
} from '../interfaces/ws-payloads.interface';

@WebSocketGateway({
    namespace: '/ws/agents',
    cors: {
        origin: '*',
    },
})
export class AgentsGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server!: Namespace;

    private readonly logger = new Logger(AgentsGateway.name);

    constructor(
        private readonly hmacAuth: AgentHmacAuthService,
        private readonly agentRegistry: AgentRegistryService,
        private readonly commandRouting: DeviceCommandRoutingService,
        private readonly workstationSession: WorkstationSessionService,
        private readonly workstationsService: WorkstationsService,
    ) { }

    afterInit(): void {
        this.logger.log('Agents WebSocket Gateway initialized (/ws/agents)');
    }

    handleConnection(client: Socket): void {
        // Agents are not authenticated on TCP connect — they must send agent:register.
        // We allow the connection but set a timeout for registration.
        this.logger.log(`Agent socket connected: ${client.id} (pending registration)`);

        const registrationTimeout = setTimeout(() => {
            if (!(client as any).agentRegistered) {
                this.logger.warn(`Agent ${client.id} did not register within timeout — disconnecting`);
                client.disconnect(true);
            }
        }, 15_000);

        (client as any)._registrationTimeout = registrationTimeout;
    }

    async handleDisconnect(client: Socket): Promise<void> {
        const timeout = (client as any)._registrationTimeout;
        if (timeout) clearTimeout(timeout);

        this.logger.log(`Agent socket disconnected: ${client.id}`);
        const agent = await this.agentRegistry.markDisconnected(client.id);

        if (agent) {
            // Notify only users bound to this workstation about device status change
            await this.notifyDeviceStatusChanged(
                agent.workstationId,
                agent.providerType,
                false,
            );

            // Handle any pending commands that were targeting this agent
            await this.commandRouting.handleAgentDisconnect(client.id);
        }
    }

    @SubscribeMessage(WsEvent.AgentRegister)
    async handleAgentRegister(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: AgentRegisterPayload,
    ): Promise<void> {
        if (!payload?.clientId || !payload?.timestamp || !payload?.signature) {
            client.emit(WsEvent.AgentError, { reason: 'Missing required registration fields' });
            client.disconnect(true);
            return;
        }

        // Validate HMAC
        const authResult = await this.hmacAuth.validateAgentRegistration(
            payload.clientId,
            payload.timestamp,
            payload.signature,
        );

        if (!authResult.valid) {
            this.logger.warn(`Agent registration rejected for ${payload.clientId}: ${authResult.reason}`);
            client.emit(WsEvent.AgentError, { reason: authResult.reason });
            client.disconnect(true);
            return;
        }

        try {
            const { deviceAgent, workstationId } = await this.agentRegistry.registerAgent(
                payload,
                client.id,
            );

            (client as any).agentRegistered = true;
            (client as any).agentClientId = payload.clientId;
            (client as any).workstationId = workstationId;

            // Clear the registration timeout
            const timeout = (client as any)._registrationTimeout;
            if (timeout) clearTimeout(timeout);

            // Join workstation room for targeted commands
            client.join(`workstation:${workstationId}`);
            client.join(`agent:${payload.providerType}:${workstationId}`);

            client.emit(WsEvent.AgentRegistered, {
                agentId: deviceAgent.id,
                workstationId,
            });

            this.logger.log(
                `Agent registered: ${payload.clientId} (${payload.providerType}) on workstation ${workstationId}`,
            );

            // Notify users bound to this workstation about device coming online
            await this.notifyDeviceStatusChanged(workstationId, payload.providerType, true);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Registration failed';
            this.logger.error(`Agent registration failed: ${message}`);
            client.emit(WsEvent.AgentError, { reason: message });
            client.disconnect(true);
        }
    }

    @SubscribeMessage(WsEvent.AgentEnroll)
    async handleAgentEnroll(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: AgentEnrollPayload,
    ): Promise<void> {
        if (!payload?.enrollmentToken || !payload?.providerType) {
            client.emit(WsEvent.AgentError, { reason: 'Missing enrollment token or provider type' });
            client.disconnect(true);
            return;
        }

        try {
            // Validate the enrollment token
            const tokenResult = await this.workstationsService.validateEnrollmentToken(
                payload.enrollmentToken,
            );
            if (!tokenResult) {
                this.logger.warn('Agent enrollment rejected: invalid or expired token');
                client.emit(WsEvent.AgentError, { reason: 'Invalid or expired enrollment token' });
                client.disconnect(true);
                return;
            }

            if (tokenResult.providerType !== payload.providerType) {
                this.logger.warn(
                    `Agent enrollment rejected: token for ${tokenResult.providerType}, agent sent ${payload.providerType}`,
                );
                client.emit(WsEvent.AgentError, { reason: 'Enrollment token provider type mismatch' });
                client.disconnect(true);
                return;
            }

            // Generate HMAC credentials for the new agent
            const clientId = `agent-${tokenResult.providerType}-${crypto.randomBytes(8).toString('hex')}`;
            const clientSecret = crypto.randomBytes(32).toString('hex');

            // Create the DeviceAgent record
            const deviceAgent = await this.agentRegistry.enrollAgent(
                tokenResult.workstationId,
                tokenResult.providerType,
                clientId,
                clientSecret,
            );

            // Mark enrollment token as consumed
            await this.workstationsService.markEnrollmentTokenUsed(tokenResult.tokenId, deviceAgent.id);

            // Clear registration timeout
            const timeout = (client as any)._registrationTimeout;
            if (timeout) clearTimeout(timeout);

            this.logger.log(
                `Agent enrolled: ${clientId} (${payload.providerType}) on workstation ${tokenResult.workstationId}`,
            );

            // Send credentials back to agent (agent should store these for future HMAC registration)
            client.emit(WsEvent.AgentEnrolled, {
                clientId,
                clientSecret,
                workstationId: tokenResult.workstationId,
            });

            // Disconnect — agent should reconnect using HMAC credentials
            client.disconnect(true);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Enrollment failed';
            this.logger.error(`Agent enrollment failed: ${message}`);
            client.emit(WsEvent.AgentError, { reason: message });
            client.disconnect(true);
        }
    }

    @SubscribeMessage(WsEvent.AgentHeartbeat)
    async handleHeartbeat(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: AgentHeartbeatPayload,
    ): Promise<void> {
        if (!(client as any).agentRegistered) return;
        await this.agentRegistry.updateHeartbeat(client.id);
    }

    @SubscribeMessage(WsEvent.AgentCommandAck)
    async handleCommandAck(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: AgentCommandAckPayload,
    ): Promise<void> {
        if (!(client as any).agentRegistered || !payload?.correlationId) return;
        await this.commandRouting.handleCommandAck(payload.correlationId);

        // Notify user that command has started (provider-aware)
        const pending = this.commandRouting.getPendingCommand(payload.correlationId);
        if (pending) {
            const event = pending.providerType === 'scanner'
                ? WsEvent.ScannerActionCompleted  // scanner ack is informational only
                : WsEvent.VisitsVisitorPrintStarted;

            if (pending.providerType !== 'scanner') {
                this.emitToUser(pending.userSocketId, pending.userId, event, {
                    correlationId: payload.correlationId,
                });
            }
        }
    }

    // handle command result from agent and route to appropriate user event
    @SubscribeMessage(WsEvent.AgentCommandResult)
    async handleCommandResult(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: AgentCommandResultPayload,
    ): Promise<void> {
        if (!(client as any).agentRegistered || !payload?.correlationId) return;

        const workstationId = (client as any).workstationId;
        const userInfo = await this.commandRouting.handleCommandResult(
            payload.correlationId,
            payload.success,
            payload.result,
            payload.errorMessage,
        );

        // Scanner results: broadcast to all users bound to this workstation
        // (covers both auto-scan from tray and user-initiated scans)
        if (workstationId && (!userInfo || userInfo.providerType === 'scanner')) {
            const event = payload.success
                ? WsEvent.ScannerActionCompleted
                : WsEvent.ScannerActionFailed;
            const data = payload.success
                ? { correlationId: payload.correlationId, result: payload.result || {} }
                : { correlationId: payload.correlationId, reason: payload.errorMessage || 'Scan failed' };

            const sessions = await this.workstationSession.findActiveSessionsByWorkstation(workstationId);
            for (const session of sessions) {
                this.emitToUser(session.userSocketId, session.userId, event, data);
            }
        } else if (userInfo) {
            // Route printer results to print-specific events
            if (payload.success) {
                this.emitToUser(userInfo.userSocketId, userInfo.userId, WsEvent.VisitsVisitorPrintCompleted, {
                    correlationId: payload.correlationId,
                    visitId: '',
                    visitorId: '',
                });
            } else {
                this.emitToUser(userInfo.userSocketId, userInfo.userId, WsEvent.VisitsVisitorPrintFailed, {
                    correlationId: payload.correlationId,
                    reason: payload.errorMessage || 'Print failed',
                    visitId: '',
                    visitorId: '',
                });
            }
        }
    }

    /**
     * Send command to a specific agent socket.
     */
    emitToAgent(socketId: string, event: string, data: unknown): void {
        this.server.to(socketId).emit(event, data);
    }

    /**
     * Emit to user — by socket if available, otherwise by user room.
     */
    private emitToUser(socketId: string | undefined, userId: string, event: string, data: unknown): void {
        const userNs = this.server.server?.of('/ws/users');
        if (!userNs)
            return;
        if (socketId) {
            userNs.to(socketId).emit(event, data);
        } else {
            userNs.to(`user:${userId}`).emit(event, data);
        }
    }

    /**
     * Notify only users bound to this workstation about device status changes.
     */
    private async notifyDeviceStatusChanged(
        workstationId: string,
        providerType: string,
        isConnected: boolean,
    ): Promise<void> {
        const userNs = this.server.server?.of('/ws/users');
        if (!userNs) return;

        const event =
            providerType === 'printer'
                ? WsEvent.DevicesPrinterStatusChanged
                : WsEvent.DevicesScannerStatusChanged;

        const payload = {
            workstationId,
            providerType,
            isConnected,
            agentVersion: null,
        };

        // Emit to global room for admin views (workstation list table)
        userNs.to('global').emit(WsEvent.DevicesStatusChanged, payload);

        const sessions = await this.workstationSession.findActiveSessionsByWorkstation(workstationId);

        for (const session of sessions) {
            userNs.to(`user:${session.userId}`).emit(event, payload);
        }

        if (sessions.length === 0) {
            this.logger.debug(
                `No active user sessions for workstation ${workstationId} — device status not emitted`,
            );
        }
    }
}
