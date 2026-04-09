import { Injectable, Logger } from '@nestjs/common';
import { InboundEvent } from '../common/interfaces/inbound-event.interface';
import { InboundEventLogService } from '../common/services/inbound-event-log.service';
import { UsersGateway } from '../../websocket/gateways/users.gateway';
import { WsEvent } from '../../websocket/enums/ws-events.enum';

@Injectable()
export class AccessControlEventsService {
    private readonly logger = new Logger(AccessControlEventsService.name);

    constructor(
        private readonly eventLogService: InboundEventLogService,
        private readonly wsGateway: UsersGateway,
    ) { }

    async processEvent(event: InboundEvent, logId: string): Promise<void> {
        this.logger.log(`Processing access-control event: ${event.eventType} (${event.externalEventId})`);

        // TODO: Dispatch to domain services based on event.eventType
        // For example:
        // - access_granted → update visitor status / log access
        // - door_forced → trigger alert
        // - door_opened / door_closed → update door state

        await this.eventLogService.markProcessed(logId);

        this.wsGateway.broadcastToAll(WsEvent.IntegrationsAccessControlEventReceived, {
            eventType: event.eventType,
            externalEventId: event.externalEventId,
            occurredAt: event.occurredAt,
            sourceEntityId: event.sourceEntityId,
        });
    }
}
