import { PrinterEventAdapter } from './printer-event.adapter';
import { IntegrationProvider } from '../../common/enums/integration-provider.enum';
import { CreatePrinterEventDto } from '../dto/create-printer-event.dto';

describe('PrinterEventAdapter', () => {
    let adapter: PrinterEventAdapter;

    beforeEach(() => {
        adapter = new PrinterEventAdapter();
    });

    it('should map all DTO fields to canonical InboundEvent', () => {
        const dto: CreatePrinterEventDto = {
            eventId: 'print-001',
            eventType: 'print_completed',
            occurredAt: '2024-06-15T10:30:00Z',
            printerId: 'printer-1',
            jobId: 'job-42',
            documentName: 'visitor-badge.pdf',
            errorDetails: undefined,
            description: 'Badge printed successfully',
            correlationId: 'corr-789',
        };

        const result = adapter.toCanonical(dto);

        expect(result.provider).toBe(IntegrationProvider.Printer);
        expect(result.externalEventId).toBe('print-001');
        expect(result.eventType).toBe('print_completed');
        expect(result.occurredAt).toEqual(new Date('2024-06-15T10:30:00Z'));
        expect(result.sourceEntityId).toBe('printer-1');
        expect(result.payload).toEqual({
            printerId: 'printer-1',
            jobId: 'job-42',
            documentName: 'visitor-badge.pdf',
            errorDetails: undefined,
            description: 'Badge printed successfully',
        });
        expect(result.metadata).toEqual({ correlationId: 'corr-789' });
    });

    it('should set sourceEntityId to null when printerId is absent', () => {
        const dto: CreatePrinterEventDto = {
            eventId: 'print-002',
            eventType: 'printer_offline',
            occurredAt: '2024-06-15T10:30:00Z',
        };

        const result = adapter.toCanonical(dto);
        expect(result.sourceEntityId).toBeNull();
    });

    it('should include errorDetails in payload', () => {
        const dto: CreatePrinterEventDto = {
            eventId: 'print-003',
            eventType: 'print_failed',
            occurredAt: '2024-06-15T10:30:00Z',
            printerId: 'printer-2',
            errorDetails: 'Paper jam in tray 2',
        };

        const result = adapter.toCanonical(dto);
        expect(result.payload.errorDetails).toBe('Paper jam in tray 2');
    });

    it('should set metadata to null when correlationId is absent', () => {
        const dto: CreatePrinterEventDto = {
            eventId: 'print-004',
            eventType: 'print_completed',
            occurredAt: '2024-06-15T10:30:00Z',
        };

        const result = adapter.toCanonical(dto);
        expect(result.metadata).toBeNull();
    });
});
