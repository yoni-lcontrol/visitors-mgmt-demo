import { Injectable, Logger } from '@nestjs/common';
import { InboundEvent } from '../common/interfaces/inbound-event.interface';
import { InboundEventLogService } from '../common/services/inbound-event-log.service';
import { UsersGateway } from '../../websocket/gateways/users.gateway';
import { WsEvent } from '../../websocket/enums/ws-events.enum';

@Injectable()
export class ScannerEventsService {
    private readonly logger = new Logger(ScannerEventsService.name);

    constructor(
        private readonly eventLogService: InboundEventLogService,
        private readonly wsGateway: UsersGateway,
    ) { }

    async processEvent(event: InboundEvent, logId: string): Promise<void> {
        this.logger.log(`Processing scanner event: ${event.eventType} (${event.externalEventId})`);

        // TODO: Dispatch to domain services based on event.eventType
        // For example:
        // - barcode_detected / qr_detected → validate visitor check-in code
        // - scan_completed → log scan result

        await this.eventLogService.markProcessed(logId);

        this.wsGateway.broadcastToAll(WsEvent.IntegrationsScannerEventReceived, {
            eventType: event.eventType,
            externalEventId: event.externalEventId,
            occurredAt: event.occurredAt,
            sourceEntityId: event.sourceEntityId,
        });
    }
}
