import { Injectable } from '@nestjs/common';
import { IntegrationProvider } from '../../integrations/common/enums/integration-provider.enum';
import { InboundEvent } from '../../integrations/common/interfaces/inbound-event.interface';
import { CreateAmadeusEventDto } from '../dto/create-amadeus-event.dto';

@Injectable()
export class AmadeusEventAdapter {
    toCanonical(dto: CreateAmadeusEventDto): InboundEvent {
        return {
            provider: IntegrationProvider.Amadeus,
            externalEventId: dto.externalEventId ?? dto.eventUid ?? '',
            eventType: dto.internalEventType,
            occurredAt: new Date(dto.occurredUtc),
            sourceEntityId: dto.objectExternalId ?? dto.controllerExternalId ?? null,
            payload: {
                sourceSystem: dto.sourceSystem,
                signalRMethod: dto.signalRMethod,
                internalEventType: dto.internalEventType,
                isActive: dto.isActive,
                occurredUtc: dto.occurredUtc,
                receivedUtc: dto.receivedUtc,
                eventUid: dto.eventUid,
                logId: dto.logId,
                eventTypeCode: dto.eventTypeCode,
                controllerExternalId: dto.controllerExternalId,
                objectExternalId: dto.objectExternalId,
                equipmentKind: dto.equipmentKind,
                equipmentName: dto.equipmentName,
                readerUid: dto.readerUid,
                inputUid: dto.inputUid,
                outputUid: dto.outputUid,
                cardholderUid: dto.cardholderUid,
                cardholderFirstName: dto.cardholderFirstName,
                cardholderLastName: dto.cardholderLastName,
                cardCode: dto.cardCode,
                carRegistrationNum: dto.carRegistrationNum,
                accessDeniedCode: dto.accessDeniedCode,
                rawPayloadJson: dto.rawPayloadJson,
            },
            metadata: null,
        };
    }
}
