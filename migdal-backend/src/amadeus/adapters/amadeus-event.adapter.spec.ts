import { AmadeusEventAdapter } from './amadeus-event.adapter';
import { IntegrationProvider } from '../../integrations/common/enums/integration-provider.enum';
import { CreateAmadeusEventDto } from '../dto/create-amadeus-event.dto';

describe('AmadeusEventAdapter', () => {
    let adapter: AmadeusEventAdapter;

    beforeEach(() => {
        adapter = new AmadeusEventAdapter();
    });

    it('should map all DTO fields to canonical InboundEvent', () => {
        const dto: CreateAmadeusEventDto = {
            sourceSystem: 'Amadeus8',
            signalRMethod: 'AccessEventArrived',
            internalEventType: 'Door.LegalCard',
            isActive: true,
            occurredUtc: '2024-06-15T10:30:00Z',
            receivedUtc: '2024-06-15T10:30:01Z',
            externalEventId: 'evt-001',
            eventUid: 'uid-001',
            logId: 12345,
            eventTypeCode: 1,
            controllerExternalId: 'ctrl-ext-1',
            objectExternalId: 'door-ext-1',
            equipmentKind: 'Door',
            equipmentName: 'Main Entrance',
            readerUid: 'reader-1',
            inputUid: 'input-1',
            outputUid: 'output-1',
            cardholderUid: 'ch-1',
            cardCode: 'CARD-555',
            carRegistrationNum: '12-345-67',
            accessDeniedCode: 0,
            rawPayloadJson: '{"raw":"data"}',
        };

        const result = adapter.toCanonical(dto);

        expect(result.provider).toBe(IntegrationProvider.Amadeus);
        expect(result.externalEventId).toBe('evt-001');
        expect(result.eventType).toBe('Door.LegalCard');
        expect(result.occurredAt).toEqual(new Date('2024-06-15T10:30:00Z'));
        expect(result.sourceEntityId).toBe('door-ext-1');
        expect(result.payload).toEqual(expect.objectContaining({
            sourceSystem: 'Amadeus8',
            signalRMethod: 'AccessEventArrived',
            internalEventType: 'Door.LegalCard',
            isActive: true,
            controllerExternalId: 'ctrl-ext-1',
            objectExternalId: 'door-ext-1',
            equipmentKind: 'Door',
            equipmentName: 'Main Entrance',
            cardholderUid: 'ch-1',
            cardCode: 'CARD-555',
            carRegistrationNum: '12-345-67',
            rawPayloadJson: '{"raw":"data"}',
        }));
        expect(result.metadata).toBeNull();
    });

    it('should use eventUid as externalEventId when externalEventId is absent', () => {
        const dto: CreateAmadeusEventDto = {
            sourceSystem: 'Amadeus8',
            signalRMethod: 'CommEventArrived',
            internalEventType: 'Communication.Lost',
            isActive: true,
            occurredUtc: '2024-06-15T10:30:00Z',
            receivedUtc: '2024-06-15T10:30:01Z',
            eventUid: 'uid-002',
            rawPayloadJson: '{}',
        };

        const result = adapter.toCanonical(dto);
        expect(result.externalEventId).toBe('uid-002');
    });

    it('should use empty string as externalEventId when both are absent', () => {
        const dto: CreateAmadeusEventDto = {
            sourceSystem: 'Amadeus8',
            signalRMethod: 'TechnicalEventArrived',
            internalEventType: 'Controller.PowerFailure',
            isActive: true,
            occurredUtc: '2024-06-15T10:30:00Z',
            receivedUtc: '2024-06-15T10:30:01Z',
            rawPayloadJson: '{}',
        };

        const result = adapter.toCanonical(dto);
        expect(result.externalEventId).toBe('');
    });

    it('should use controllerExternalId as sourceEntityId when objectExternalId is absent', () => {
        const dto: CreateAmadeusEventDto = {
            sourceSystem: 'Amadeus8',
            signalRMethod: 'CommEventArrived',
            internalEventType: 'Communication.Lost',
            isActive: true,
            occurredUtc: '2024-06-15T10:30:00Z',
            receivedUtc: '2024-06-15T10:30:01Z',
            controllerExternalId: 'ctrl-ext-2',
            rawPayloadJson: '{}',
        };

        const result = adapter.toCanonical(dto);
        expect(result.sourceEntityId).toBe('ctrl-ext-2');
    });

    it('should set sourceEntityId to null when both IDs are absent', () => {
        const dto: CreateAmadeusEventDto = {
            sourceSystem: 'Amadeus8',
            signalRMethod: 'AlarmEventArrived',
            internalEventType: 'Door.ForceOpened',
            isActive: true,
            occurredUtc: '2024-06-15T10:30:00Z',
            receivedUtc: '2024-06-15T10:30:01Z',
            rawPayloadJson: '{}',
        };

        const result = adapter.toCanonical(dto);
        expect(result.sourceEntityId).toBeNull();
    });
});
