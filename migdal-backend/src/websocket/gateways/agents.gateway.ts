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
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { Namespace, Socket } from 'socket.io';
import { AgentHmacAuthService } from '../../agents/services/agent-hmac-auth.service';
import { AgentRegistryService } from '../../agents/services/agent-registry.service';
import {
    DeviceCommandRoutingService,
    PendingCommandInfo,
} from '../../device-commands/services/device-command-routing.service';
import { WorkstationSessionService } from '../../workstations/services/workstation-session.service';
import { WorkstationsService } from '../../workstations/services/workstations.service';
import { IntegrationProvider } from '../../integrations/common/enums/integration-provider.enum';
import { KioskGateway } from './kiosk.gateway';
import { WsEvent } from '../enums/ws-events.enum';
import {
    AgentRegisterPayload,
    AgentEnrollPayload,
    AgentHeartbeatPayload,
    AgentCommandAckPayload,
    AgentCommandResultPayload,
    AgentStatusUpdatePayload,
} from '../interfaces/ws-payloads.interface';

@WebSocketGateway({
    namespace: '/ws/agents',
    cors: {
        origin: '*',
    },
    maxHttpBufferSize: 10e6, // 10MB to accommodate base64 scan images
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
        @Inject(forwardRef(() => KioskGateway))
        private readonly kioskGateway: KioskGateway,
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
                null,
            );
        }

        // Fail only the commands that were in flight on *this* agent socket, and
        // notify each command's own originator (kiosk or user).
        const failedCommands = await this.commandRouting.handleAgentDisconnect(client.id);
        for (const info of failedCommands) {
            this.notifyCommandFailure(info, 'Agent disconnected during execution');
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
            (client as any).providerType = payload.providerType;

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
            await this.notifyDeviceStatusChanged(workstationId, payload.providerType, true, payload.deviceConnected ?? null);
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

    @SubscribeMessage(WsEvent.AgentStatusUpdate)
    async handleStatusUpdate(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: AgentStatusUpdatePayload,
    ): Promise<void> {
        if (!(client as any).agentRegistered) return;

        const deviceConnected =
            typeof payload?.deviceConnected === 'boolean'
                ? payload.deviceConnected
                : payload?.status === 'ready';

        const agent = await this.agentRegistry.updateDeviceConnected(client.id, deviceConnected);
        if (agent) {
            await this.notifyDeviceStatusChanged(
                agent.workstationId,
                agent.providerType,
                true,
                deviceConnected,
            );

            const providerType = this.getProviderType(client) ?? agent.providerType;

            // Forward in-progress device status to kiosks on this workstation
            if (providerType === IntegrationProvider.Printer) {
                if (payload?.status === 'printing') {
                    this.kioskGateway.emitPrintStatusToWorkstation(agent.workstationId, {
                        correlationId: (payload as any)?.correlationId ?? '',
                        state: 'printing',
                        message: 'Printing card…',
                        serverTimeUtc: new Date().toISOString(),
                    });
                }
            } else if (payload?.status === 'scanning') {
                this.kioskGateway.emitScanStatusToWorkstation(agent.workstationId, {
                    state: 'scanning',
                    message: 'Scanning document...',
                    scanning: 'true',
                    processing: false,
                    progress: 0,
                    serverTimeUtc: new Date().toISOString(),
                });
            }
        }
    }

    @SubscribeMessage(WsEvent.AgentCommandAck)
    async handleCommandAck(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: AgentCommandAckPayload,
    ): Promise<void> {
        if (!(client as any).agentRegistered || !payload?.correlationId) return;
        await this.commandRouting.handleCommandAck(payload.correlationId);

        const providerType = this.getProviderType(client);

        // Notify the requesting user that the print has started (staff/Admin-SPA flow)
        const pending = this.commandRouting.getPendingCommand(payload.correlationId);
        if (pending && pending.origin === 'user' && pending.providerType === IntegrationProvider.Printer) {
            this.emitToUser(pending.userSocketId, pending.userId, WsEvent.VisitsVisitorPrintStarted, {
                correlationId: payload.correlationId,
            });
        }

        // Notify kiosks on this workstation that the device has started working
        const workstationId = (client as any).workstationId;
        if (!workstationId) return;

        if (providerType === IntegrationProvider.Printer) {
            this.kioskGateway.emitPrintStatusToWorkstation(workstationId, {
                correlationId: payload.correlationId,
                state: 'printing',
                message: 'Printing card…',
                serverTimeUtc: new Date().toISOString(),
            });
        } else {
            this.kioskGateway.emitScanStatusToWorkstation(workstationId, {
                state: 'scanning',
                message: 'Scanning document...',
                scanning: 'true',
                processing: false,
                progress: 0,
                serverTimeUtc: new Date().toISOString(),
            });
        }
    }

    // handle command result from agent and route to appropriate user event
    @SubscribeMessage(WsEvent.AgentCommandResult)
    async handleCommandResult(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: AgentCommandResultPayload,
    ): Promise<void> {
        if (!(client as any).agentRegistered || !payload?.correlationId) return;

        const workstationId = (client as any).workstationId as string | undefined;
        const providerType = this.getProviderType(client);
        this.logger.debug(
            `Agent command result: correlationId=${payload.correlationId}, success=${payload.success}, workstation=${workstationId}, provider=${providerType}`,
        );

        // Strip image from the result before storing to DB (can be multi-MB).
        // Only the DB copy is stripped — the kiosk/user copies keep the full image.
        const resultForDb = payload.result ? { ...payload.result } : undefined;
        if (resultForDb && 'image' in resultForDb) {
            (resultForDb as any).image = resultForDb.image ? '[base64_stripped]' : '';
        }

        let pending: PendingCommandInfo | null = null;
        try {
            pending = await this.commandRouting.handleCommandResult(
                payload.correlationId,
                payload.success,
                resultForDb,
                payload.errorMessage,
            );
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`commandRouting.handleCommandResult failed: ${message}`);
        }

        if (providerType === IntegrationProvider.Printer) {
            // A missing pending entry means the command was already evicted (timeout) —
            // treat it like a kiosk print so the kiosk still gets a terminal event.
            if (!pending || pending.origin === 'kiosk') {
                const targetWorkstationId = pending?.workstationId ?? workstationId;
                if (targetWorkstationId) {
                    this.kioskGateway.emitPrintStatusToWorkstation(targetWorkstationId, {
                        correlationId: payload.correlationId,
                        state: payload.success ? 'completed' : 'failed',
                        message: payload.success
                            ? 'Card printed'
                            : payload.errorMessage || 'Print failed',
                        serverTimeUtc: new Date().toISOString(),
                    });
                    this.kioskGateway.emitPrintResultToWorkstation(targetWorkstationId, {
                        correlationId: payload.correlationId,
                        success: payload.success,
                        errorMessage: payload.errorMessage,
                    });
                }
                return;
            }

            // User-originated (Admin-SPA staff print) — notify the requesting user
            if (payload.success) {
                this.emitToUser(pending.userSocketId, pending.userId, WsEvent.VisitsVisitorPrintCompleted, {
                    correlationId: payload.correlationId,
                    visitId: '',
                    visitorId: '',
                });
            } else {
                this.emitToUser(pending.userSocketId, pending.userId, WsEvent.VisitsVisitorPrintFailed, {
                    correlationId: payload.correlationId,
                    reason: payload.errorMessage || 'Print failed',
                    visitId: '',
                    visitorId: '',
                });
            }
            return;
        }

        // Scanner results: broadcast to all kiosks + users bound to this workstation
        // (covers both auto-scan from tray and user-initiated scans)
        if (!workstationId) return;

        // Forward scan results to kiosk FIRST (highest priority for kiosk flow)
        this.kioskGateway.emitScanResultToWorkstation(workstationId, {
            correlationId: payload.correlationId,
            success: payload.success,
            result: payload.result,
            errorMessage: payload.errorMessage,
        });

        // Then broadcast to user sessions (non-critical for kiosk flow)
        try {
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
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Error broadcasting scan result to user sessions: ${message}`);
        }
    }

    /**
     * Send command to a specific agent socket.
     */
    emitToAgent(socketId: string, event: string, data: unknown): void {
        this.server.to(socketId).emit(event, data);
    }

    /**
     * Provider type stamped on the socket during agent:register.
     */
    private getProviderType(client: Socket): IntegrationProvider | undefined {
        return (client as any).providerType as IntegrationProvider | undefined;
    }

    /**
     * Notify the originator (kiosk or user) that an in-flight command will never complete.
     */
    private notifyCommandFailure(info: PendingCommandInfo, reason: string): void {
        if (info.origin === 'kiosk') {
            if (info.providerType === IntegrationProvider.Printer) {
                this.kioskGateway.emitPrintStatusToWorkstation(info.workstationId, {
                    correlationId: info.correlationId,
                    state: 'failed',
                    message: reason,
                    serverTimeUtc: new Date().toISOString(),
                });
                this.kioskGateway.emitPrintResultToWorkstation(info.workstationId, {
                    correlationId: info.correlationId,
                    success: false,
                    errorMessage: reason,
                });
            } else {
                this.kioskGateway.emitScanResultToWorkstation(info.workstationId, {
                    correlationId: info.correlationId,
                    success: false,
                    errorMessage: reason,
                });
            }
            return;
        }

        if (info.providerType === IntegrationProvider.Printer) {
            this.emitToUser(info.userSocketId, info.userId, WsEvent.VisitsVisitorPrintFailed, {
                correlationId: info.correlationId,
                reason,
                visitId: '',
                visitorId: '',
            });
        } else {
            this.emitToUser(info.userSocketId, info.userId, WsEvent.ScannerActionFailed, {
                correlationId: info.correlationId,
                reason,
            });
        }
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
        deviceConnected: boolean | null,
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
            deviceConnected,
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
