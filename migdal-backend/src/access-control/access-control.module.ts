import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import * as https from 'https';
import {
    AcController,
    Door,
    Extension,
    DoorIo,
    ExtensionIo,
    AccessLevel,
} from './entities';
import { AcControllerController } from './controllers/ac-controller.controller';
import { ImportController } from './controllers/import.controller';
import { DoorController } from './controllers/door.controller';
import { ExtensionController } from './controllers/extension.controller';
import { DoorIoController } from './controllers/door-io.controller';
import { ExtensionIoController } from './controllers/extension-io.controller';
import { AccessLevelController } from './controllers/access-level.controller';
import { CardholderController } from './controllers/cardholder.controller';
import { AcControllerService } from './services/ac-controller.service';
import { DoorService } from './services/door.service';
import { ExtensionService } from './services/extension.service';
import { DoorIoService } from './services/door-io.service';
import { ExtensionIoService } from './services/extension-io.service';
import { AccessLevelService } from './services/access-level.service';
import { ImportService } from './services/import.service';
import { AccessControlApiService } from './services/ac-api.service';
import { CardholderService } from './services/cardholder.service';
import { Building } from '../buildings/entities/building.entity';
import { WebsocketModule } from '../websocket/websocket.module';
import { AmadeusSyncQueueModule } from './amadeus-sync-queue.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            AcController,
            Door,
            Extension,
            DoorIo,
            ExtensionIo,
            AccessLevel,
            Building,
        ]),
        HttpModule.register({
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        }),
        WebsocketModule,
        AmadeusSyncQueueModule,
    ],
    controllers: [
        AcControllerController,
        ImportController,
        DoorController,
        ExtensionController,
        DoorIoController,
        ExtensionIoController,
        AccessLevelController,
        CardholderController,
    ],
    providers: [
        AcControllerService,
        DoorService,
        ExtensionService,
        DoorIoService,
        ExtensionIoService,
        AccessLevelService,
        ImportService,
        AccessControlApiService,
        CardholderService,
    ],
    exports: [AcControllerService, AccessControlApiService],
})
export class AccessControlModule { }
