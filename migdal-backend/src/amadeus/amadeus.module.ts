import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcController } from '../access-control/entities/ac-controller.entity';
import { Door } from '../access-control/entities/door.entity';
import { DoorIo } from '../access-control/entities/door-io.entity';
import { Extension } from '../access-control/entities/extension.entity';
import { ExtensionIo } from '../access-control/entities/extension-io.entity';
import { ParkingRequest } from '../visitors/entities/parking-request.entity';
import { Visitor } from '../visitors/entities/visitor.entity';
import { VisitVisitor } from '../visitors/entities/visit-visitor.entity';
import { VisitVisitorStatus } from '../visitors/entities/visit-visitor-status.entity';
import { VisitEscort } from '../visitors/entities/visit-escort.entity';
import { EscortGuestPairing } from '../visitors/entities/escort-guest-pairing.entity';
import { UserBadge } from '../users/entities/user-badge.entity';
import { PermanentEscort } from '../settings/entities/permanent-escort.entity';
import { IntegrationsCommonModule } from '../integrations/common/integrations-common.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { SettingsModule } from '../settings/settings.module';
import { AccessControlModule } from '../access-control/access-control.module';
import { AmadeusSyncQueueModule } from '../access-control/amadeus-sync-queue.module';
import { AmadeusController } from './amadeus.controller';
import { AmadeusEventsController } from './amadeus-events.controller';
import { AmadeusUsersController } from './amadeus-users.controller';
import { AmadeusSyncQueueController } from './controllers/amadeus-sync-queue.controller';
import { AmadeusService } from './amadeus.service';
import { AmadeusEventsService } from './amadeus-events.service';
import { AmadeusEventAdapter } from './adapters/amadeus-event.adapter';
import { AmadeusUsersService } from './services/amadeus-users.service';
import { AmadeusParkingSyncService } from './services/amadeus-parking-sync.service';
import { EscortGuestPairingService } from './services/escort-guest-pairing.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            AcController,
            Door,
            DoorIo,
            Extension,
            ExtensionIo,
            ParkingRequest,
            Visitor,
            VisitVisitor,
            VisitVisitorStatus,
            VisitEscort,
            EscortGuestPairing,
            UserBadge,
            PermanentEscort,
        ]),
        IntegrationsCommonModule,
        WebsocketModule,
        SettingsModule,
        AccessControlModule,
        AmadeusSyncQueueModule,
    ],
    controllers: [AmadeusController, AmadeusEventsController, AmadeusUsersController, AmadeusSyncQueueController],
    providers: [AmadeusService, AmadeusEventsService, AmadeusEventAdapter, AmadeusUsersService, AmadeusParkingSyncService, EscortGuestPairingService],
    exports: [AmadeusParkingSyncService, AmadeusUsersService, AmadeusSyncQueueModule],
})
export class AmadeusModule { }
