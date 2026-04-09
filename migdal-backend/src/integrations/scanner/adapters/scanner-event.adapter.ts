import { Injectable } from '@nestjs/common';
import { IntegrationProvider } from '../../common/enums/integration-provider.enum';
import { InboundEvent } from '../../common/interfaces/inbound-event.interface';
import { CreateScannerEventDto } from '../dto/create-scanner-event.dto';

@Injectable()
export class ScannerEventAdapter {
    toCanonical(dto: CreateScannerEventDto): InboundEvent {
        return {
            provider: IntegrationProvider.Scanner,
            externalEventId: dto.eventId,
            eventType: dto.eventType,
            occurredAt: new Date(dto.occurredAt),
            sourceEntityId: dto.scannerId ?? null,
            payload: {
                scannerId: dto.scannerId,
                codeType: dto.codeType,
                codeValue: dto.codeValue,
                description: dto.description,
            },
            metadata: dto.correlationId ? { correlationId: dto.correlationId } : null,
        };
    }
}
