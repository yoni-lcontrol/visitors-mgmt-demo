import { Test, TestingModule } from '@nestjs/testing';
import { ScannerEventsController } from './scanner-events.controller';
import { ScannerEventsService } from './scanner-events.service';
import { ScannerEventAdapter } from './adapters/scanner-event.adapter';
import { InboundEventLogService } from '../common/services/inbound-event-log.service';
import { IntegrationAuthService } from '../common/services/integration-auth.service';
import { IntegrationHmacGuard } from '../common/guards/integration-hmac.guard';
import { IntegrationProvider } from '../common/enums/integration-provider.enum';
import { InboundEvent } from '../common/interfaces/inbound-event.interface';

describe('ScannerEventsController', () => {
    let controller: ScannerEventsController;
    let mockAdapter: { toCanonical: jest.Mock };
    let mockEventsService: { processEvent: jest.Mock };
    let mockEventLogService: {
        isDuplicate: jest.Mock;
        createLog: jest.Mock;
        markFailed: jest.Mock;
    };

    const mockCanonicalEvent: InboundEvent = {
        provider: IntegrationProvider.Scanner,
        externalEventId: 'scan-001',
        eventType: 'scan_completed',
        occurredAt: new Date('2024-06-15T10:30:00Z'),
        sourceEntityId: 'scanner-1',
        payload: { scannerId: 'scanner-1', codeType: 'qr', codeValue: 'VISITOR-123' },
        metadata: null,
    };

    const mockRequest = {
        integrationClient: { clientId: 'scanner-client', provider: 'scanner', secret: 's', enabled: true },
        headers: { 'x-signature': 'sig-scanner' },
    } as any;

    beforeEach(async () => {
        mockAdapter = { toCanonical: jest.fn().mockReturnValue(mockCanonicalEvent) };
        mockEventsService = { processEvent: jest.fn().mockResolvedValue(undefined) };
        mockEventLogService = {
            isDuplicate: jest.fn().mockResolvedValue(false),
            createLog: jest.fn().mockResolvedValue({ id: 'log-2' }),
            markFailed: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [ScannerEventsController],
            providers: [
                { provide: ScannerEventAdapter, useValue: mockAdapter },
                { provide: ScannerEventsService, useValue: mockEventsService },
                { provide: InboundEventLogService, useValue: mockEventLogService },
                { provide: IntegrationAuthService, useValue: {} },
                { provide: IntegrationHmacGuard, useValue: { canActivate: () => true } },
            ],
        }).compile();

        controller = module.get<ScannerEventsController>(ScannerEventsController);
    });

    describe('receiveEvent', () => {
        const dto = {
            eventId: 'scan-001',
            eventType: 'scan_completed',
            occurredAt: '2024-06-15T10:30:00Z',
            scannerId: 'scanner-1',
        };

        it('should process event and return processed status', async () => {
            const result = await controller.receiveEvent(dto as any, mockRequest);

            expect(mockAdapter.toCanonical).toHaveBeenCalledWith(dto);
            expect(mockEventLogService.isDuplicate).toHaveBeenCalledWith(
                IntegrationProvider.Scanner,
                'scan-001',
            );
            expect(mockEventLogService.createLog).toHaveBeenCalledWith('scanner-client', 'sig-scanner', mockCanonicalEvent);
            expect(mockEventsService.processEvent).toHaveBeenCalledWith(mockCanonicalEvent, 'log-2');
            expect(result).toEqual({ status: 'processed', eventId: 'log-2' });
        });

        it('should return duplicate status without processing', async () => {
            mockEventLogService.isDuplicate.mockResolvedValue(true);

            const result = await controller.receiveEvent(dto as any, mockRequest);

            expect(result).toEqual({ status: 'duplicate', eventId: 'scan-001' });
            expect(mockEventLogService.createLog).not.toHaveBeenCalled();
            expect(mockEventsService.processEvent).not.toHaveBeenCalled();
        });

        it('should return failed status on processing error', async () => {
            mockEventsService.processEvent.mockRejectedValue(new Error('Scanner processing failed'));

            const result = await controller.receiveEvent(dto as any, mockRequest);

            expect(result).toEqual({ status: 'failed', eventId: 'log-2' });
            expect(mockEventLogService.markFailed).toHaveBeenCalledWith('log-2', 'Scanner processing failed');
        });
    });
});
