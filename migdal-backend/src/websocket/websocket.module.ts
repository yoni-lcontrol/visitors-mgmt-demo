import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersGateway } from './gateways/users.gateway';
import { AgentsGateway } from './gateways/agents.gateway';
import { WorkstationsModule } from '../workstations/workstations.module';
import { AgentsModule } from '../agents/agents.module';
import { DeviceCommandsModule } from '../device-commands/device-commands.module';
import { ScanningModule } from '../scanning/scanning.module';

@Module({
    imports: [
        JwtModule.register({}),
        WorkstationsModule,
        AgentsModule,
        DeviceCommandsModule,
        ScanningModule,
    ],
    providers: [UsersGateway, AgentsGateway],
    exports: [UsersGateway, AgentsGateway],
})
export class WebsocketModule { }
