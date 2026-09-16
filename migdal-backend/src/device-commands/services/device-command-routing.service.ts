import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { DeviceCommandLog } from '../entities/device-command-log.entity';
import { DeviceCommandStatus } from '../enums/device-command-status.enum';
import { AgentRegistryService } from '../../agents/services/agent-registry.service';
import { WorkstationSessionService } from '../../workstations/services/workstation-session.service';
import { IntegrationProvider } from '../../integrations/common/enums/integration-provider.enum';

export interface CreateCommandRequest {
    userId: string;
    providerType: IntegrationProvider;
    commandType: string;
    requestPayload: Record<string, unknown>;
}

export interface CreateKioskCommandRequest {
    workstationId: string;
    providerType: IntegrationProvider;
    commandType: string;
    requestPayload: Record<string, unknown>;
    correlationId?: string;
}

export interface CommandRouteResult {
    commandLog: DeviceCommandLog;
    agentSocketId: string;
    correlationId: string;
}

/** Snapshot of a command awaiting an agent response. */
export interface PendingCommandInfo {
    correlationId: string;
    /** 'user' = Admin-SPA / staff flow (has a user session), 'kiosk' = anonymous kiosk flow. */
    origin: 'user' | 'kiosk';
    userId: string;
    userSocketId: string | undefined;
    workstationId: string;
    providerType: IntegrationProvider;
    commandType: string;
    agentSocketId: string;
    commandLogId: string | null;
}

type PendingCommandEntry = PendingCommandInfo & {
    timeoutHandle: ReturnType<typeof setTimeout>;
};

type CommandTimeoutListener = (info: PendingCommandInfo) => void;

@Injectable()
export class DeviceCommandRoutingService {
    private readonly logger = new Logger(DeviceCommandRoutingService.name);

    // In-memory map: correlationId -> pending command info (+ its timeout handle)
    private readonly pendingCommands = new Map<string, PendingCommandEntry>();

    private readonly timeoutListeners: CommandTimeoutListener[] = [];

    private readonly COMMAND_TIMEOUT_MS = 30_000;

    constructor(
        @InjectRepository(DeviceCommandLog)
        private readonly commandLogRepo: Repository<DeviceCommandLog>,
        private readonly agentRegistry: AgentRegistryService,
        private readonly workstationSession: WorkstationSessionService,
    ) { }

    /**
     * Register a listener invoked whenever a pending command times out.
     * Used by gateways to notify the originating kiosk/user.
     */
    onCommandTimeout(listener: CommandTimeoutListener): void {
        this.timeoutListeners.push(listener);
    }

    async routeCommand(
        request: CreateCommandRequest,
        userSocketId?: string,
    ): Promise<CommandRouteResult> {
        // 1. Resolve user's active workstation
        const session = await this.workstationSession.getActiveSession(request.userId);
        if (!session) {
            throw new BadRequestException('No active workstation binding for user');
        }

        // 2. Resolve active agent for that workstation + provider
        const agentConnection = await this.agentRegistry.findActiveConnection(
            session.workstationId,
            request.providerType,
        );
        if (!agentConnection) {
            throw new ServiceUnavailableException(
                `No active ${request.providerType} agent for workstation ${session.workstationId}`,
            );
        }

        if (!agentConnection.socketId) {
            throw new ServiceUnavailableException(
                `Agent for ${request.providerType} on workstation ${session.workstationId} has no socket`,
            );
        }

        // 3. Create command log
        const correlationId = uuidv4();
        const commandLog = this.commandLogRepo.create({
            requestedByUserId: request.userId,
            workstationId: session.workstationId,
            providerType: request.providerType,
            commandType: request.commandType,
            targetAgentId: agentConnection.id,
            correlationId,
            status: DeviceCommandStatus.Queued,
            requestPayloadJson: JSON.stringify(request.requestPayload),
        });
        const savedLog = await this.commandLogRepo.save(commandLog);

        // 4. Track pending command for timeout + user correlation
        this.registerPending({
            correlationId,
            origin: 'user',
            userId: request.userId,
            userSocketId,
            workstationId: session.workstationId,
            providerType: request.providerType,
            commandType: request.commandType,
            agentSocketId: agentConnection.socketId,
            commandLogId: savedLog?.id ?? null,
        });

        this.logger.log(
            `Command routed: ${correlationId} (${request.commandType}) -> agent socket ${agentConnection.socketId}`,
        );

        return {
            commandLog: savedLog,
            agentSocketId: agentConnection.socketId,
            correlationId,
        };
    }

    /**
     * Route a command originating from a kiosk. The kiosk is anonymous — there is no
     * user session to resolve, the workstation is supplied directly by the caller.
     */
    async routeKioskCommand(request: CreateKioskCommandRequest): Promise<CommandRouteResult> {
        const agentConnection = await this.agentRegistry.findActiveConnection(
            request.workstationId,
            request.providerType,
        );
        if (!agentConnection) {
            throw new ServiceUnavailableException(
                `No active ${request.providerType} agent for workstation ${request.workstationId}`,
            );
        }

        if (!agentConnection.socketId) {
            throw new ServiceUnavailableException(
                `Agent for ${request.providerType} on workstation ${request.workstationId} has no socket`,
            );
        }

        const correlationId = request.correlationId || uuidv4();
        const commandLog = this.commandLogRepo.create({
            requestedByUserId: null,
            workstationId: request.workstationId,
            providerType: request.providerType,
            commandType: request.commandType,
            targetAgentId: agentConnection.id,
            correlationId,
            status: DeviceCommandStatus.Queued,
            requestPayloadJson: JSON.stringify(request.requestPayload),
        });
        const savedLog = await this.commandLogRepo.save(commandLog);

        this.registerPending({
            correlationId,
            origin: 'kiosk',
            userId: '',
            userSocketId: undefined,
            workstationId: request.workstationId,
            providerType: request.providerType,
            commandType: request.commandType,
            agentSocketId: agentConnection.socketId,
            commandLogId: savedLog?.id ?? null,
        });

        this.logger.log(
            `Kiosk command routed: ${correlationId} (${request.commandType}) -> agent socket ${agentConnection.socketId}`,
        );

        return {
            commandLog: savedLog,
            agentSocketId: agentConnection.socketId,
            correlationId,
        };
    }

    async handleCommandAck(correlationId: string): Promise<void> {
        await this.commandLogRepo.update(
            { correlationId },
            { status: DeviceCommandStatus.Acknowledged },
        );
    }

    async handleCommandResult(
        correlationId: string,
        success: boolean,
        result?: Record<string, unknown>,
        errorMessage?: string,
    ): Promise<PendingCommandInfo | null> {
        const pending = this.pendingCommands.get(correlationId);
        if (pending) {
            clearTimeout(pending.timeoutHandle);
            this.pendingCommands.delete(correlationId);
        }

        const status = success ? DeviceCommandStatus.Completed : DeviceCommandStatus.Failed;
        await this.commandLogRepo.update(
            { correlationId },
            {
                status,
                responsePayloadJson: result ? JSON.stringify(result) : null,
                errorMessage: errorMessage || null,
                completedAt: new Date(),
            },
        );

        return pending ? this.toInfo(pending) : null;
    }

    /**
     * Fail every pending command that was dispatched to the agent socket that just
     * dropped — and only those. Returns the failed commands so callers can notify
     * the right kiosk/user.
     */
    async handleAgentDisconnect(agentSocketId: string): Promise<PendingCommandInfo[]> {
        const affected: PendingCommandInfo[] = [];
        for (const pending of this.pendingCommands.values()) {
            if (pending.agentSocketId === agentSocketId) {
                affected.push(this.toInfo(pending));
            }
        }

        for (const info of affected) {
            await this.handleCommandResult(
                info.correlationId,
                false,
                undefined,
                'Agent disconnected during execution',
            );
        }

        if (affected.length > 0) {
            this.logger.warn(
                `Agent socket ${agentSocketId} disconnected — failed ${affected.length} pending command(s)`,
            );
        }

        return affected;
    }

    getPendingCommand(correlationId: string): PendingCommandInfo | undefined {
        const pending = this.pendingCommands.get(correlationId);
        return pending ? this.toInfo(pending) : undefined;
    }

    private registerPending(info: PendingCommandInfo): void {
        const timeoutHandle = setTimeout(() => {
            this.handleTimeout(info.correlationId).catch((err) =>
                this.logger.error(`Timeout handling failed for ${info.correlationId}: ${err.message}`),
            );
        }, this.COMMAND_TIMEOUT_MS);

        this.pendingCommands.set(info.correlationId, { ...info, timeoutHandle });
    }

    private toInfo(pending: PendingCommandEntry): PendingCommandInfo {
        const { timeoutHandle: _timeoutHandle, ...info } = pending;
        return info;
    }

    private async handleTimeout(correlationId: string): Promise<void> {
        const pending = this.pendingCommands.get(correlationId);
        if (!pending) return;

        const info = this.toInfo(pending);
        this.pendingCommands.delete(correlationId);

        for (const listener of this.timeoutListeners) {
            try {
                listener(info);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                this.logger.error(`Command timeout listener failed for ${correlationId}: ${message}`);
            }
        }

        await this.commandLogRepo.update(
            { correlationId },
            {
                status: DeviceCommandStatus.Timeout,
                errorMessage: 'Command timed out waiting for agent response',
                completedAt: new Date(),
            },
        );

        this.logger.warn(`Command timed out: ${correlationId}`);
    }
}
