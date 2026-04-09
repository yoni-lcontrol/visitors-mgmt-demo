import { Module } from '@nestjs/common';
import { WebsocketModule } from '../../websocket/websocket.module';
import { IntegrationsCommonModule } from '../common/integrations-common.module';
import { PrinterEventsController } from './printer-events.controller';
import { PrinterEventsService } from './printer-events.service';
import { PrinterEventAdapter } from './adapters/printer-event.adapter';

@Module({
    imports: [IntegrationsCommonModule, WebsocketModule],
    controllers: [PrinterEventsController],
    providers: [PrinterEventsService, PrinterEventAdapter],
})
export class PrinterIntegrationModule { }
