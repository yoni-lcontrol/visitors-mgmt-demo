import { Injectable } from '@nestjs/common';
import { IntegrationProvider } from '../../common/enums/integration-provider.enum';
import { InboundEvent } from '../../common/interfaces/inbound-event.interface';
import { CreateAccessControlEventDto } from '../dto/create-access-control-event.dto';

@Injectable()
export class AccessControlEventAdapter {
    toCanonical(dto: CreateAccessControlEventDto): InboundEvent {
        return {
            provider: IntegrationProvider.AccessControl,
            externalEventId: dto.eventId,
            eventType: dto.eventType,
            occurredAt: new Date(dto.occurredAt),
            sourceEntityId: dto.doorId ?? dto.controllerId ?? null,
            payload: {
                doorId: dto.doorId,
                controllerId: dto.controllerId,
                cardNumber: dto.cardNumber,
                personId: dto.personId,
                description: dto.description,
            },
            metadata: dto.correlationId ? { correlationId: dto.correlationId } : null,
        };
    }
}
