import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceAgent } from './entities/device-agent.entity';
import { AgentHmacAuthService } from './services/agent-hmac-auth.service';
import { AgentRegistryService } from './services/agent-registry.service';
import { WorkstationsModule } from '../workstations/workstations.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([DeviceAgent]),
        WorkstationsModule,
    ],
    providers: [AgentHmacAuthService, AgentRegistryService],
    exports: [AgentHmacAuthService, AgentRegistryService, TypeOrmModule],
})
export class AgentsModule { }
