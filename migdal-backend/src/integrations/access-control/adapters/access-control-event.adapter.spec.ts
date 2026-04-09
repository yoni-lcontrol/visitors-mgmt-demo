import { AccessControlEventAdapter } from './access-control-event.adapter';
import { IntegrationProvider } from '../../common/enums/integration-provider.enum';
import { CreateAccessControlEventDto } from '../dto/create-access-control-event.dto';

describe('AccessControlEventAdapter', () => {
    let adapter: AccessControlEventAdapter;

    beforeEach(() => {
        adapter = new AccessControlEventAdapter();
    });

    it('should map all DTO fields to canonical InboundEvent', () => {
        const dto: CreateAccessControlEventDto = {
            eventId: 'evt-001',
            eventType: 'access_granted',
            occurredAt: '2024-06-15T10:30:00Z',
            doorId: 'door-1',
            controllerId: 'ctrl-1',
            cardNumber: 'CARD-555',
            personId: 'person-42',
            description: 'Access granted at main entrance',
            correlationId: 'corr-123',
        };

        const result = adapter.toCanonical(dto);

        expect(result.provider).toBe(IntegrationProvider.AccessControl);
        expect(result.externalEventId).toBe('evt-001');
        expect(result.eventType).toBe('access_granted');
        expect(result.occurredAt).toEqual(new Date('2024-06-15T10:30:00Z'));
        expect(result.sourceEntityId).toBe('door-1');
        expect(result.payload).toEqual({
            doorId: 'door-1',
            controllerId: 'ctrl-1',
            cardNumber: 'CARD-555',
            personId: 'person-42',
            description: 'Access granted at main entrance',
        });
        expect(result.metadata).toEqual({ correlationId: 'corr-123' });
    });

    it('should use controllerId as sourceEntityId when doorId is absent', () => {
        const dto: CreateAccessControlEventDto = {
            eventId: 'evt-002',
            eventType: 'door_forced',
            occurredAt: '2024-06-15T10:30:00Z',
            controllerId: 'ctrl-2',
        };

        const result = adapter.toCanonical(dto);
        expect(result.sourceEntityId).toBe('ctrl-2');
    });

    it('should set sourceEntityId to null when both doorId and controllerId are absent', () => {
        const dto: CreateAccessControlEventDto = {
            eventId: 'evt-003',
            eventType: 'system_event',
            occurredAt: '2024-06-15T10:30:00Z',
        };

        const result = adapter.toCanonical(dto);
        expect(result.sourceEntityId).toBeNull();
    });

    it('should set metadata to null when correlationId is absent', () => {
        const dto: CreateAccessControlEventDto = {
            eventId: 'evt-004',
            eventType: 'access_denied',
            occurredAt: '2024-06-15T10:30:00Z',
        };

        const result = adapter.toCanonical(dto);
        expect(result.metadata).toBeNull();
    });
});
