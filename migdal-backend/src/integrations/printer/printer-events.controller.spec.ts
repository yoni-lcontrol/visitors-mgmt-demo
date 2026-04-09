import { Test, TestingModule } from '@nestjs/testing';
import { PrinterEventsController } from './printer-events.controller';
import { PrinterEventsService } from './printer-events.service';
import { PrinterEventAdapter } from './adapters/printer-event.adapter';
import { InboundEventLogService } from '../common/services/inbound-event-log.service';
import { IntegrationAuthService } from '../common/services/integration-auth.service';
import { IntegrationHmacGuard } from '../common/guards/integration-hmac.guard';
import { IntegrationProvider } from '../common/enums/integration-provider.enum';
import { InboundEvent } from '../common/interfaces/inbound-event.interface';

describe('PrinterEventsController', () => {
    let controller: PrinterEventsController;
    let mockAdapter: { toCanonical: jest.Mock };
    let mockEventsService: { processEvent: jest.Mock };
    let mockEventLogService: {
        isDuplicate: jest.Mock;
        createLog: jest.Mock;
        markFailed: jest.Mock;
    };

    const mockCanonicalEvent: InboundEvent = {
        provider: IntegrationProvider.Printer,
        externalEventId: 'print-001',
        eventType: 'print_completed',
        occurredAt: new Date('2024-06-15T10:30:00Z'),
        sourceEntityId: 'printer-1',
        payload: { printerId: 'printer-1', jobId: 'job-42' },
        metadata: null,
    };

    const mockRequest = {
        integrationClient: { clientId: 'printer-client', provider: 'printer', secret: 's', enabled: true },
        headers: { 'x-signature': 'sig-printer' },
    } as any;

    beforeEach(async () => {
        mockAdapter = { toCanonical: jest.fn().mockReturnValue(mockCanonicalEvent) };
        mockEventsService = { processEvent: jest.fn().mockResolvedValue(undefined) };
        mockEventLogService = {
            isDuplicate: jest.fn().mockResolvedValue(false),
            createLog: jest.fn().mockResolvedValue({ id: 'log-3' }),
            markFailed: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [PrinterEventsController],
            providers: [
                { provide: PrinterEventAdapter, useValue: mockAdapter },
                { provide: PrinterEventsService, useValue: mockEventsService },
                { provide: InboundEventLogService, useValue: mockEventLogService },
                { provide: IntegrationAuthService, useValue: {} },
                { provide: IntegrationHmacGuard, useValue: { canActivate: () => true } },
            ],
        }).compile();

        controller = module.get<PrinterEventsController>(PrinterEventsController);
    });

    describe('receiveEvent', () => {
        const dto = {
            eventId: 'print-001',
            eventType: 'print_completed',
            occurredAt: '2024-06-15T10:30:00Z',
            printerId: 'printer-1',
        };

        it('should process event and return processed status', async () => {
            const result = await controller.receiveEvent(dto as any, mockRequest);

            expect(mockAdapter.toCanonical).toHaveBeenCalledWith(dto);
            expect(mockEventLogService.isDuplicate).toHaveBeenCalledWith(
                IntegrationProvider.Printer,
                'print-001',
            );
            expect(mockEventLogService.createLog).toHaveBeenCalledWith('printer-client', 'sig-printer', mockCanonicalEvent);
            expect(mockEventsService.processEvent).toHaveBeenCalledWith(mockCanonicalEvent, 'log-3');
            expect(result).toEqual({ status: 'processed', eventId: 'log-3' });
        });

        it('should return duplicate status without processing', async () => {
            mockEventLogService.isDuplicate.mockResolvedValue(true);

            const result = await controller.receiveEvent(dto as any, mockRequest);

            expect(result).toEqual({ status: 'duplicate', eventId: 'print-001' });
            expect(mockEventLogService.createLog).not.toHaveBeenCalled();
            expect(mockEventsService.processEvent).not.toHaveBeenCalled();
        });

        it('should return failed status on processing error', async () => {
            mockEventsService.processEvent.mockRejectedValue(new Error('Printer offline'));

            const result = await controller.receiveEvent(dto as any, mockRequest);

            expect(result).toEqual({ status: 'failed', eventId: 'log-3' });
            expect(mockEventLogService.markFailed).toHaveBeenCalledWith('log-3', 'Printer offline');
        });
    });
});
