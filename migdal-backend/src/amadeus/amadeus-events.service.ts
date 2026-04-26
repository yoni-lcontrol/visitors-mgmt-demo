import { Injectable, Logger } from '@nestjs/common';
import { InboundEvent } from '../integrations/common/interfaces/inbound-event.interface';
import { IntegrationProvider } from '../integrations/common/enums/integration-provider.enum';
import { ExternalEventLog } from '../integrations/common/entities/external-event-log.entity';
import { InboundEventLogService } from '../integrations/common/services/inbound-event-log.service';
import { UsersGateway } from '../websocket/gateways/users.gateway';
import { WsEvent } from '../websocket/enums/ws-events.enum';

export interface AmadeusRealtimeEvent {
    eventType: string;
    externalEventId: string;
    occurredAt: string | Date;
    sourceEntityId?: string | null;
    isActive: boolean;
    signalRMethod: string;
    equipmentKind: string;
    equipmentName: string;
    controllerExternalId?: string | null;
    cardholderName?: string | null;
    cardholderUid?: string | null;
    cardCode?: string | null;
}

@Injectable()
export class AmadeusEventsService {
    private readonly logger = new Logger(AmadeusEventsService.name);

    constructor(
        private readonly eventLogService: InboundEventLogService,
        private readonly wsGateway: UsersGateway,
    ) { }

    async getRecentEvents(limit = 200): Promise<AmadeusRealtimeEvent[]> {
        const logs = await this.eventLogService.findRecentByProvider(IntegrationProvider.Amadeus, limit);
        return logs.map((log) => this.mapLogToRealtimeEvent(log));
    }

    async processEvent(event: InboundEvent, logId: string): Promise<void> {
        const payload = event.payload as Record<string, unknown>;
        const cardholderName = this.resolveCardholderName(payload);

        this.logger.log(
            `Processing Amadeus event: ${event.eventType} ` +
            `(externalEventId=${event.externalEventId}, ` +
            `controllerExternalId=${payload.controllerExternalId ?? 'N/A'}, ` +
            `cardholderUid=${payload.cardholderUid ?? 'N/A'}, ` +
            `equipmentKind=${payload.equipmentKind ?? 'N/A'})`,
        );

        await this.eventLogService.markProcessed(logId);

        this.wsGateway.broadcastToAll(WsEvent.IntegrationsAmadeusEventReceived, {
            eventType: event.eventType,
            externalEventId: event.externalEventId,
            occurredAt: event.occurredAt,
            sourceEntityId: event.sourceEntityId,
            isActive: payload.isActive,
            signalRMethod: payload.signalRMethod,
            equipmentKind: payload.equipmentKind,
            equipmentName: payload.equipmentName,
            controllerExternalId: payload.controllerExternalId,
            cardholderName,
            cardholderUid: payload.cardholderUid,
            cardCode: payload.cardCode,
        });
    }

    private mapLogToRealtimeEvent(log: ExternalEventLog): AmadeusRealtimeEvent {
        const payload = this.parsePayload(log.payloadJson);

        return {
            eventType: log.eventType,
            externalEventId: log.externalEventId ?? log.id,
            occurredAt: this.asOptionalDateValue(payload.occurredAt) ?? this.asOptionalDateValue(payload.occurredUtc) ?? log.receivedAt,
            sourceEntityId: this.asOptionalString(payload.sourceEntityId),
            isActive: payload.isActive !== false,
            signalRMethod: this.asString(payload.signalRMethod),
            equipmentKind: this.asString(payload.equipmentKind),
            equipmentName: this.asString(payload.equipmentName),
            controllerExternalId: this.asOptionalString(payload.controllerExternalId),
            cardholderName: this.resolveCardholderName(payload),
            cardholderUid: this.asOptionalString(payload.cardholderUid),
            cardCode: this.asOptionalString(payload.cardCode),
        };
    }

    private resolveCardholderName(payload: Record<string, unknown>): string | null {
        const directName = this.asOptionalString(payload.cardholderName);
        if (directName) {
            return directName;
        }

        const directFirstName = this.asOptionalString(payload.cardholderFirstName)?.trim();
        const directLastName = this.asOptionalString(payload.cardholderLastName)?.trim();
        const directFullName = [directFirstName, directLastName].filter(Boolean).join(' ').trim();

        if (directFullName) {
            return directFullName;
        }

        const rawPayload = this.parseNestedRawPayload(payload.rawPayloadJson);
        const firstName = this.asOptionalString(rawPayload.cardholderFirstName)?.trim();
        const lastName = this.asOptionalString(rawPayload.cardholderLastName)?.trim();
        const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

        if (fullName) {
            return fullName;
        }

        return this.asOptionalString(rawPayload.cardholderName);
    }

    private parsePayload(payloadJson: string): Record<string, unknown> {
        try {
            return JSON.parse(payloadJson) as Record<string, unknown>;
        } catch {
            this.logger.warn('Failed to parse Amadeus event payload JSON from ExternalEventLogs');
            return {};
        }
    }

    private parseNestedRawPayload(rawPayloadJson: unknown): Record<string, unknown> {
        if (typeof rawPayloadJson !== 'string' || !rawPayloadJson.trim()) {
            return {};
        }

        try {
            return JSON.parse(rawPayloadJson) as Record<string, unknown>;
        } catch {
            this.logger.warn('Failed to parse nested rawPayloadJson from Amadeus event payload');
            return {};
        }
    }

    private asString(value: unknown): string {
        return typeof value === 'string' ? value : '';
    }

    private asOptionalString(value: unknown): string | null {
        return typeof value === 'string' ? value : null;
    }

    private asOptionalDateValue(value: unknown): string | Date | null {
        if (typeof value === 'string' || value instanceof Date) {
            return value;
        }

        return null;
    }
}
