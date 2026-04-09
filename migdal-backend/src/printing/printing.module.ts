import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrintingService } from './services/printing.service';
import { DeviceCommandsModule } from '../device-commands/device-commands.module';
import { WorkstationsModule } from '../workstations/workstations.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { CardTemplate } from '../settings/entities/card-template.entity';
import { Visitor } from '../visitors/entities/visitor.entity';
import { Visit } from '../visitors/entities/visit.entity';

@Module({
    imports: [
        DeviceCommandsModule,
        WorkstationsModule,
        WebsocketModule,
        TypeOrmModule.forFeature([CardTemplate, Visitor, Visit]),
    ],
    providers: [PrintingService],
    exports: [PrintingService],
})
export class PrintingModule { }
