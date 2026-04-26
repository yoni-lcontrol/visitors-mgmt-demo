import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcController } from '../access-control/entities/ac-controller.entity';
import { Door } from '../access-control/entities/door.entity';
import { DoorIo } from '../access-control/entities/door-io.entity';
import { Extension } from '../access-control/entities/extension.entity';
import { ExtensionIo } from '../access-control/entities/extension-io.entity';
import { IntegrationsCommonModule } from '../integrations/common/integrations-common.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { AmadeusController } from './amadeus.controller';
import { AmadeusEventsController } from './amadeus-events.controller';
import { AmadeusService } from './amadeus.service';
import { AmadeusEventsService } from './amadeus-events.service';
import { AmadeusEventAdapter } from './adapters/amadeus-event.adapter';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            AcController,
            Door,
            DoorIo,
            Extension,
            ExtensionIo,
        ]),
        IntegrationsCommonModule,
        WebsocketModule,
    ],
    controllers: [AmadeusController, AmadeusEventsController],
    providers: [AmadeusService, AmadeusEventsService, AmadeusEventAdapter],
})
export class AmadeusModule { }
