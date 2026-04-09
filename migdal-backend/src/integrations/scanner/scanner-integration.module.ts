import { Module } from '@nestjs/common';
import { WebsocketModule } from '../../websocket/websocket.module';
import { IntegrationsCommonModule } from '../common/integrations-common.module';
import { ScannerEventsController } from './scanner-events.controller';
import { ScannerEventsService } from './scanner-events.service';
import { ScannerEventAdapter } from './adapters/scanner-event.adapter';

@Module({
    imports: [IntegrationsCommonModule, WebsocketModule],
    controllers: [ScannerEventsController],
    providers: [ScannerEventsService, ScannerEventAdapter],
})
export class ScannerIntegrationModule { }
