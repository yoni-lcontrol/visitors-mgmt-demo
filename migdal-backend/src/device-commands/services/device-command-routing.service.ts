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

export interface CommandRouteResult {
    commandLog: DeviceCommandLog;
    agentSocketId: string;
    correlationId: string;
}

@Injectable()
export class DeviceCommandRoutingService {
    private readonly logger = new Logger(DeviceCommandRoutingService.name);

    // In-memory map: correlationId -> { userSocketId, userId, providerType, commandType }
    private readonly pendingCommands = new Map<
        string,
        { userSocketId: string | undefined; userId: string; providerType: IntegrationProvider; commandType: string; timeoutHandle: ReturnType<typeof setTimeout> }
    >();

    private readonly COMMAND_TIMEOUT_MS = 30_000;

    constructor(
        @InjectRepository(DeviceCommandLog)
        private readonly commandLogRepo: Repository<DeviceCommandLog>,
        private readonly agentRegistry: AgentRegistryService,
        private readonly workstationSession: WorkstationSessionService,
    ) { }

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
        const timeoutHandle = setTimeout(() => {
            this.handleTimeout(correlationId).catch((err) =>
                this.logger.error(`Timeout handling failed for ${correlationId}: ${err.message}`),
            );
        }, this.COMMAND_TIMEOUT_MS);

        this.pendingCommands.set(correlationId, {
            userSocketId,
            userId: request.userId,
            providerType: request.providerType,
            commandType: request.commandType,
            timeoutHandle,
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
    ): Promise<{ userSocketId: string | undefined; userId: string; providerType: IntegrationProvider; commandType: string } | null> {
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

        return pending ? { userSocketId: pending.userSocketId, userId: pending.userId, providerType: pending.providerType, commandType: pending.commandType } : null;
    }

    async handleAgentDisconnect(socketId: string): Promise<void> {
        // Find any pending commands targeted at this agent's socket
        for (const [correlationId, pending] of this.pendingCommands.entries()) {
            // We need to check if the agent socket matches
            const log = await this.commandLogRepo.findOne({ where: { correlationId } });
            if (log && log.status !== DeviceCommandStatus.Completed && log.status !== DeviceCommandStatus.Failed) {
                await this.handleCommandResult(
                    correlationId,
                    false,
                    undefined,
                    'Agent disconnected during execution',
                );
            }
        }
    }

    getPendingCommand(correlationId: string): { userSocketId: string | undefined; userId: string; providerType: IntegrationProvider; commandType: string } | undefined {
        const pending = this.pendingCommands.get(correlationId);
        return pending ? { userSocketId: pending.userSocketId, userId: pending.userId, providerType: pending.providerType, commandType: pending.commandType } : undefined;
    }

    private async handleTimeout(correlationId: string): Promise<void> {
        const pending = this.pendingCommands.get(correlationId);
        if (!pending) return;

        this.pendingCommands.delete(correlationId);
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
