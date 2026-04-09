import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceAgent } from '../entities/device-agent.entity';
import { Workstation } from '../../workstations/entities/workstation.entity';
import { IntegrationProvider } from '../../integrations/common/enums/integration-provider.enum';
import { AgentRegisterPayload } from '../../websocket/interfaces/ws-payloads.interface';

@Injectable()
export class AgentRegistryService {
    private readonly logger = new Logger(AgentRegistryService.name);

    constructor(
        @InjectRepository(DeviceAgent)
        private readonly deviceAgentRepo: Repository<DeviceAgent>,
        @InjectRepository(Workstation)
        private readonly workstationRepo: Repository<Workstation>,
    ) { }

    async registerAgent(
        payload: AgentRegisterPayload,
        socketId: string,
    ): Promise<{ deviceAgent: DeviceAgent; workstationId: string }> {
        // Find device agent by clientId
        const deviceAgent = await this.deviceAgentRepo.findOne({
            where: { clientId: payload.clientId, isEnabled: true, isActive: true },
        });
        if (!deviceAgent) {
            throw new NotFoundException(`Device agent not found for clientId: ${payload.clientId}`);
        }

        // Workstation is determined by the device agent's pre-assigned workstationId
        const workstation = await this.workstationRepo.findOne({
            where: { id: deviceAgent.workstationId, isActive: true },
        });
        if (!workstation) {
            throw new NotFoundException(`Workstation not found for agent: ${payload.clientId}`);
        }

        // Stamp machineId/hostname on workstation if provided and not yet set
        let wsUpdated = false;
        if (payload.machineId && !workstation.machineId) {
            workstation.machineId = payload.machineId;
            wsUpdated = true;
        }
        if (payload.hostname && !workstation.hostname) {
            workstation.hostname = payload.hostname;
            wsUpdated = true;
        }
        if (wsUpdated) {
            await this.workstationRepo.save(workstation);
        }

        // Update device agent: version + connection state
        const now = new Date();
        deviceAgent.version = payload.version;
        deviceAgent.socketId = socketId;
        deviceAgent.isConnected = true;
        deviceAgent.deviceConnected = payload.deviceConnected ?? null;
        deviceAgent.connectedAt = now;
        deviceAgent.lastSeenAt = now;
        deviceAgent.disconnectedAt = null;
        deviceAgent.capabilitiesJson = payload.capabilities ? JSON.stringify(payload.capabilities) : null;
        await this.deviceAgentRepo.save(deviceAgent);

        this.logger.log(
            `Agent registered: ${payload.clientId} (${payload.providerType}) on workstation ${workstation.code}, socket=${socketId}`,
        );

        return { deviceAgent, workstationId: workstation.id };
    }

    /**
     * Enroll a new agent via enrollment token and create the DeviceAgent record.
     */
    async enrollAgent(
        workstationId: string,
        providerType: string,
        clientId: string,
        clientSecret: string,
    ): Promise<DeviceAgent> {
        // Deactivate any existing agents of the same type on this workstation
        await this.deviceAgentRepo.update(
            { workstationId, providerType: providerType as IntegrationProvider, isActive: true },
            { isActive: false, isEnabled: false },
        );

        const agent = this.deviceAgentRepo.create({
            workstationId,
            providerType: providerType as IntegrationProvider,
            clientId,
            clientSecret,
            isEnabled: true,
        });
        return this.deviceAgentRepo.save(agent);
    }

    async updateHeartbeat(socketId: string): Promise<void> {
        await this.deviceAgentRepo.update(
            { socketId, isConnected: true },
            { lastSeenAt: new Date() },
        );
    }

    async markDisconnected(socketId: string): Promise<DeviceAgent | null> {
        const agent = await this.deviceAgentRepo.findOne({
            where: { socketId, isConnected: true },
        });
        if (!agent) return null;

        agent.isConnected = false;
        agent.deviceConnected = null;
        agent.socketId = null;
        agent.disconnectedAt = new Date();
        await this.deviceAgentRepo.save(agent);

        this.logger.log(`Agent disconnected: socket=${socketId}, workstation=${agent.workstationId}`);
        return agent;
    }

    async updateDeviceConnected(
        socketId: string,
        deviceConnected: boolean,
    ): Promise<DeviceAgent | null> {
        const agent = await this.deviceAgentRepo.findOne({
            where: { socketId, isConnected: true },
        });
        if (!agent) return null;

        agent.deviceConnected = deviceConnected;
        agent.lastSeenAt = new Date();
        await this.deviceAgentRepo.save(agent);

        this.logger.log(
            `Agent device status updated: socket=${socketId}, workstation=${agent.workstationId}, deviceConnected=${deviceConnected}`,
        );
        return agent;
    }

    async findActiveConnection(
        workstationId: string,
        providerType: IntegrationProvider,
    ): Promise<DeviceAgent | null> {
        return this.deviceAgentRepo.findOne({
            where: {
                workstationId,
                providerType,
                isConnected: true,
                isActive: true,
                isEnabled: true,
            },
        });
    }

    async findActiveConnectionsByWorkstation(
        workstationId: string,
    ): Promise<DeviceAgent[]> {
        return this.deviceAgentRepo.find({
            where: {
                workstationId,
                isConnected: true,
                isActive: true,
                isEnabled: true,
            },
        });
    }
}
