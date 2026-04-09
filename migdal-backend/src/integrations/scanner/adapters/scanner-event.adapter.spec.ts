import { ScannerEventAdapter } from './scanner-event.adapter';
import { IntegrationProvider } from '../../common/enums/integration-provider.enum';
import { CreateScannerEventDto } from '../dto/create-scanner-event.dto';

describe('ScannerEventAdapter', () => {
    let adapter: ScannerEventAdapter;

    beforeEach(() => {
        adapter = new ScannerEventAdapter();
    });

    it('should map all DTO fields to canonical InboundEvent', () => {
        const dto: CreateScannerEventDto = {
            eventId: 'scan-001',
            eventType: 'scan_completed',
            occurredAt: '2024-06-15T10:30:00Z',
            scannerId: 'scanner-1',
            codeType: 'qr',
            codeValue: 'VISITOR-12345',
            description: 'QR code scanned at lobby',
            correlationId: 'corr-456',
        };

        const result = adapter.toCanonical(dto);

        expect(result.provider).toBe(IntegrationProvider.Scanner);
        expect(result.externalEventId).toBe('scan-001');
        expect(result.eventType).toBe('scan_completed');
        expect(result.occurredAt).toEqual(new Date('2024-06-15T10:30:00Z'));
        expect(result.sourceEntityId).toBe('scanner-1');
        expect(result.payload).toEqual({
            scannerId: 'scanner-1',
            codeType: 'qr',
            codeValue: 'VISITOR-12345',
            description: 'QR code scanned at lobby',
        });
        expect(result.metadata).toEqual({ correlationId: 'corr-456' });
    });

    it('should set sourceEntityId to null when scannerId is absent', () => {
        const dto: CreateScannerEventDto = {
            eventId: 'scan-002',
            eventType: 'scan_failed',
            occurredAt: '2024-06-15T10:30:00Z',
        };

        const result = adapter.toCanonical(dto);
        expect(result.sourceEntityId).toBeNull();
    });

    it('should set metadata to null when correlationId is absent', () => {
        const dto: CreateScannerEventDto = {
            eventId: 'scan-003',
            eventType: 'scan_completed',
            occurredAt: '2024-06-15T10:30:00Z',
        };

        const result = adapter.toCanonical(dto);
        expect(result.metadata).toBeNull();
    });
});
