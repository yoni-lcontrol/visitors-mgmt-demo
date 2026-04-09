import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceCommandLog } from './entities/device-command-log.entity';
import { DeviceCommandRoutingService } from './services/device-command-routing.service';
import { AgentsModule } from '../agents/agents.module';
import { WorkstationsModule } from '../workstations/workstations.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([DeviceCommandLog]),
        AgentsModule,
        WorkstationsModule,
    ],
    providers: [DeviceCommandRoutingService],
    exports: [DeviceCommandRoutingService],
})
export class DeviceCommandsModule { }
