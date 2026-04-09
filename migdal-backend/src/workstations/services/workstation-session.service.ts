import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { UserWorkstationSession } from '../entities/user-workstation-session.entity';
import { Workstation } from '../entities/workstation.entity';
import { WorkstationUser } from '../entities/workstation-user.entity';
import { WorkstationRole } from '../entities/workstation-role.entity';
import { DeviceAgent } from '../../agents/entities/device-agent.entity';
import { IntegrationProvider } from '../../integrations/common/enums/integration-provider.enum';

@Injectable()
export class WorkstationSessionService {
    private readonly logger = new Logger(WorkstationSessionService.name);

    constructor(
        @InjectRepository(UserWorkstationSession)
        private readonly sessionRepo: Repository<UserWorkstationSession>,
        @InjectRepository(Workstation)
        private readonly workstationRepo: Repository<Workstation>,
        @InjectRepository(DeviceAgent)
        private readonly deviceAgentRepo: Repository<DeviceAgent>,
        @InjectRepository(WorkstationUser)
        private readonly workstationUserRepo: Repository<WorkstationUser>,
        @InjectRepository(WorkstationRole)
        private readonly workstationRoleRepo: Repository<WorkstationRole>,
    ) { }

    async bindUserToWorkstation(
        userId: string,
        userSocketId: string,
        workstationId: string,
        userRoleIds: string[],
    ): Promise<{ session: UserWorkstationSession; workstation: Workstation }> {
        // Validate workstation exists
        const workstation = await this.workstationRepo.findOne({
            where: { id: workstationId, isActive: true },
        });
        if (!workstation) {
            throw new NotFoundException('Workstation not found');
        }

        // Validate user has access to this workstation
        const hasAccess = await this.checkUserAccess(userId, userRoleIds, workstationId);
        if (!hasAccess) {
            throw new ForbiddenException('User does not have access to this workstation');
        }

        // Deactivate any existing active sessions for this user
        await this.sessionRepo.update(
            { userId, isActive: true },
            { isActive: false, disconnectedAt: new Date() },
        );

        // Create new session
        const now = new Date();
        const session = this.sessionRepo.create({
            userId,
            workstationId: workstation.id,
            userSocketId,
            connectedAt: now,
            lastSeenAt: now,
        });
        const savedSession = await this.sessionRepo.save(session);

        this.logger.log(
            `User ${userId} bound to workstation ${workstation.code} (socket: ${userSocketId})`,
        );

        return { session: savedSession, workstation };
    }

    async checkUserAccess(userId: string, userRoleIds: string[], workstationId: string): Promise<boolean> {
        const userAssignment = await this.workstationUserRepo.findOne({
            where: { workstationId, userId, isActive: true },
        });
        if (userAssignment) return true;

        if (userRoleIds.length > 0) {
            const roleAssignment = await this.workstationRoleRepo.findOne({
                where: { workstationId, isActive: true, roleId: In(userRoleIds) },
            });
            if (roleAssignment) return true;
        }

        return false;
    }

    async getActiveSession(userId: string): Promise<UserWorkstationSession | null> {
        return this.sessionRepo.findOne({
            where: { userId, isActive: true },
            relations: ['workstation'],
            order: { connectedAt: 'DESC' },
        });
    }

    async getActiveSessionBySocketId(userSocketId: string): Promise<UserWorkstationSession | null> {
        return this.sessionRepo.findOne({
            where: { userSocketId, isActive: true },
            relations: ['workstation'],
        });
    }

    async markDisconnected(userSocketId: string): Promise<void> {
        await this.sessionRepo.update(
            { userSocketId, isActive: true },
            { isActive: false, disconnectedAt: new Date() },
        );
    }

    async updateLastSeen(userSocketId: string): Promise<void> {
        await this.sessionRepo.update(
            { userSocketId, isActive: true },
            { lastSeenAt: new Date() },
        );
    }

    async findActiveSessionsByWorkstation(workstationId: string): Promise<UserWorkstationSession[]> {
        return this.sessionRepo.find({
            where: { workstationId, isActive: true },
        });
    }

    async bindUserToWorkstationWithDeviceStatus(
        userId: string,
        userSocketId: string,
        workstationId: string,
        userRoleIds: string[],
    ): Promise<{
        workstationId: string;
        code: string;
        displayName: string;
        devices: Array<{ providerType: string; isConnected: boolean; agentVersion: string | null; lastSeenAt: string | null; capabilities: string[] | null }>;
    }> {
        const { workstation } = await this.bindUserToWorkstation(userId, userSocketId, workstationId, userRoleIds);
        return this.buildWorkstationDeviceStatus(workstation);
    }

    async getActiveSessionWithDeviceStatus(
        userId: string,
    ): Promise<{
        workstationId: string;
        code: string;
        displayName: string;
        devices: Array<{ providerType: string; isConnected: boolean; agentVersion: string | null; lastSeenAt: string | null; capabilities: string[] | null }>;
    } | null> {
        const session = await this.getActiveSession(userId);
        if (!session?.workstation) return null;
        return this.buildWorkstationDeviceStatus(session.workstation);
    }

    private async buildWorkstationDeviceStatus(
        workstation: Workstation,
    ): Promise<{
        workstationId: string;
        code: string;
        displayName: string;
        devices: Array<{ providerType: string; isConnected: boolean; agentVersion: string | null; lastSeenAt: string | null; capabilities: string[] | null }>;
    }> {
        const agents = await this.deviceAgentRepo.find({
            where: {
                workstationId: workstation.id,
                isActive: true,
                isEnabled: true,
            },
        });

        const devices = [IntegrationProvider.Printer, IntegrationProvider.Scanner].map((provider) => {
            const agent = agents.find((a) => a.providerType === provider);
            return {
                providerType: provider,
                isConnected: agent?.isConnected ?? false,
                agentVersion: agent?.version ?? null,
                lastSeenAt: agent?.lastSeenAt ? agent.lastSeenAt.toISOString() : null,
                capabilities: agent?.capabilitiesJson ? JSON.parse(agent.capabilitiesJson) : null,
            };
        });

        return {
            workstationId: workstation.id,
            code: workstation.code,
            displayName: workstation.displayName,
            devices,
        };
    }

    async findAllWithDeviceStatus(): Promise<
        Array<{
            id: string;
            code: string;
            displayName: string;
            machineId: string | null;
            hostname: string | null;
            devices: Array<{ providerType: string; isConnected: boolean }>;
        }>
    > {
        const workstations = await this.workstationRepo.find({
            where: { isActive: true },
            order: { displayName: 'ASC' },
        });

        const connectedAgents = await this.deviceAgentRepo.find({
            where: { isConnected: true, isActive: true, isEnabled: true },
        });

        return workstations.map((ws) => {
            const wsAgents = connectedAgents.filter((a) => a.workstationId === ws.id);
            return {
                id: ws.id,
                code: ws.code,
                displayName: ws.displayName,
                machineId: ws.machineId,
                hostname: ws.hostname,
                devices: wsAgents.map((a) => ({
                    providerType: a.providerType,
                    isConnected: true,
                })),
            };
        });
    }
}
