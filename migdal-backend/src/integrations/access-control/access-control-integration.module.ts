import { Module } from '@nestjs/common';
import { WebsocketModule } from '../../websocket/websocket.module';
import { IntegrationsCommonModule } from '../common/integrations-common.module';
import { AccessControlEventsController } from './access-control-events.controller';
import { AccessControlEventsService } from './access-control-events.service';
import { AccessControlEventAdapter } from './adapters/access-control-event.adapter';

@Module({
    imports: [IntegrationsCommonModule, WebsocketModule],
    controllers: [AccessControlEventsController],
    providers: [AccessControlEventsService, AccessControlEventAdapter],
})
export class AccessControlIntegrationModule { }
