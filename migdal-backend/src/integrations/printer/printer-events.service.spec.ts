import { Test, TestingModule } from '@nestjs/testing';
import { PrinterEventsService } from './printer-events.service';
import { InboundEventLogService } from '../common/services/inbound-event-log.service';
import { UsersGateway } from '../../websocket/gateways/users.gateway';
import { WsEvent } from '../../websocket/enums/ws-events.enum';
import { IntegrationProvider } from '../common/enums/integration-provider.enum';
import { InboundEvent } from '../common/interfaces/inbound-event.interface';
import { createMockWsGateway } from '../../test-utils/mock.factory';

describe('PrinterEventsService', () => {
    let service: PrinterEventsService;
    let mockEventLogService: { markProcessed: jest.Mock };
    let mockWsGateway: ReturnType<typeof createMockWsGateway>;

    const mockEvent: InboundEvent = {
        provider: IntegrationProvider.Printer,
        externalEventId: 'print-001',
        eventType: 'print_completed',
        occurredAt: new Date('2024-06-15T10:30:00Z'),
        sourceEntityId: 'printer-1',
        payload: { printerId: 'printer-1', jobId: 'job-42', documentName: 'badge.pdf' },
        metadata: null,
    };

    beforeEach(async () => {
        mockEventLogService = { markProcessed: jest.fn().mockResolvedValue(undefined) };
        mockWsGateway = createMockWsGateway();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PrinterEventsService,
                { provide: InboundEventLogService, useValue: mockEventLogService },
                { provide: UsersGateway, useValue: mockWsGateway },
            ],
        }).compile();

        service = module.get<PrinterEventsService>(PrinterEventsService);
    });

    describe('processEvent', () => {
        it('should mark the log as processed', async () => {
            await service.processEvent(mockEvent, 'log-3');
            expect(mockEventLogService.markProcessed).toHaveBeenCalledWith('log-3');
        });

        it('should broadcast WS event to all clients', async () => {
            await service.processEvent(mockEvent, 'log-3');

            expect(mockWsGateway.broadcastToAll).toHaveBeenCalledWith(
                WsEvent.IntegrationsPrinterEventReceived,
                {
                    eventType: 'print_completed',
                    externalEventId: 'print-001',
                    occurredAt: mockEvent.occurredAt,
                    sourceEntityId: 'printer-1',
                },
            );
        });
    });
});
