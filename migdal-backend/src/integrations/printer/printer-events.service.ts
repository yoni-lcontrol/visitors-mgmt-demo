import { Injectable, Logger } from '@nestjs/common';
import { InboundEvent } from '../common/interfaces/inbound-event.interface';
import { InboundEventLogService } from '../common/services/inbound-event-log.service';
import { UsersGateway } from '../../websocket/gateways/users.gateway';
import { WsEvent } from '../../websocket/enums/ws-events.enum';

@Injectable()
export class PrinterEventsService {
    private readonly logger = new Logger(PrinterEventsService.name);

    constructor(
        private readonly eventLogService: InboundEventLogService,
        private readonly wsGateway: UsersGateway,
    ) { }

    async processEvent(event: InboundEvent, logId: string): Promise<void> {
        this.logger.log(`Processing printer event: ${event.eventType} (${event.externalEventId})`);

        // TODO: Dispatch to domain services based on event.eventType
        // For example:
        // - print_completed → update badge print status
        // - printer_offline → trigger alert
        // - paper_jam → notify operator

        await this.eventLogService.markProcessed(logId);

        this.wsGateway.broadcastToAll(WsEvent.IntegrationsPrinterEventReceived, {
            eventType: event.eventType,
            externalEventId: event.externalEventId,
            occurredAt: event.occurredAt,
            sourceEntityId: event.sourceEntityId,
        });
    }
}
