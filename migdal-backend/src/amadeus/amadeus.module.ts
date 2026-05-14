import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcController } from '../access-control/entities/ac-controller.entity';
import { Door } from '../access-control/entities/door.entity';
import { DoorIo } from '../access-control/entities/door-io.entity';
import { Extension } from '../access-control/entities/extension.entity';
import { ExtensionIo } from '../access-control/entities/extension-io.entity';
import { ParkingRequest } from '../visitors/entities/parking-request.entity';
import { IntegrationsCommonModule } from '../integrations/common/integrations-common.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { AccessControlModule } from '../access-control/access-control.module';
import { AmadeusController } from './amadeus.controller';
import { AmadeusEventsController } from './amadeus-events.controller';
import { AmadeusUsersController } from './amadeus-users.controller';
import { AmadeusService } from './amadeus.service';
import { AmadeusEventsService } from './amadeus-events.service';
import { AmadeusEventAdapter } from './adapters/amadeus-event.adapter';
import { AmadeusUsersService } from './services/amadeus-users.service';
import { AmadeusParkingSyncService } from './services/amadeus-parking-sync.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            AcController,
            Door,
            DoorIo,
            Extension,
            ExtensionIo,
            ParkingRequest,
        ]),
        IntegrationsCommonModule,
        WebsocketModule,
        AccessControlModule,
    ],
    controllers: [AmadeusController, AmadeusEventsController, AmadeusUsersController],
    providers: [AmadeusService, AmadeusEventsService, AmadeusEventAdapter, AmadeusUsersService, AmadeusParkingSyncService],
    exports: [AmadeusParkingSyncService],
})
export class AmadeusModule { }
