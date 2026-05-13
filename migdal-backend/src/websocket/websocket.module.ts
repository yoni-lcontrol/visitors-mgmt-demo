import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { UsersGateway } from './gateways/users.gateway';
import { AgentsGateway } from './gateways/agents.gateway';
import { KioskGateway } from './gateways/kiosk.gateway';
import { WorkstationsModule } from '../workstations/workstations.module';
import { AgentsModule } from '../agents/agents.module';
import { DeviceCommandsModule } from '../device-commands/device-commands.module';
import { ScanningModule } from '../scanning/scanning.module';

@Module({
    imports: [
        JwtModule.register({}),
        ConfigModule,
        WorkstationsModule,
        AgentsModule,
        DeviceCommandsModule,
        ScanningModule,
    ],
    providers: [UsersGateway, AgentsGateway, KioskGateway],
    exports: [UsersGateway, AgentsGateway, KioskGateway],
})
export class WebsocketModule { }
