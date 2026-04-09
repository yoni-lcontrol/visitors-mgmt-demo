import { Injectable } from '@nestjs/common';
import { IntegrationProvider } from '../../common/enums/integration-provider.enum';
import { InboundEvent } from '../../common/interfaces/inbound-event.interface';
import { CreatePrinterEventDto } from '../dto/create-printer-event.dto';

@Injectable()
export class PrinterEventAdapter {
    toCanonical(dto: CreatePrinterEventDto): InboundEvent {
        return {
            provider: IntegrationProvider.Printer,
            externalEventId: dto.eventId,
            eventType: dto.eventType,
            occurredAt: new Date(dto.occurredAt),
            sourceEntityId: dto.printerId ?? null,
            payload: {
                printerId: dto.printerId,
                jobId: dto.jobId,
                documentName: dto.documentName,
                errorDetails: dto.errorDetails,
                description: dto.description,
            },
            metadata: dto.correlationId ? { correlationId: dto.correlationId } : null,
        };
    }
}
