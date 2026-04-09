import { Test, TestingModule } from '@nestjs/testing';
import { ScannerEventsService } from './scanner-events.service';
import { InboundEventLogService } from '../common/services/inbound-event-log.service';
import { UsersGateway } from '../../websocket/gateways/users.gateway';
import { WsEvent } from '../../websocket/enums/ws-events.enum';
import { IntegrationProvider } from '../common/enums/integration-provider.enum';
import { InboundEvent } from '../common/interfaces/inbound-event.interface';
import { createMockWsGateway } from '../../test-utils/mock.factory';

describe('ScannerEventsService', () => {
    let service: ScannerEventsService;
    let mockEventLogService: { markProcessed: jest.Mock };
    let mockWsGateway: ReturnType<typeof createMockWsGateway>;

    const mockEvent: InboundEvent = {
        provider: IntegrationProvider.Scanner,
        externalEventId: 'scan-001',
        eventType: 'scan_completed',
        occurredAt: new Date('2024-06-15T10:30:00Z'),
        sourceEntityId: 'scanner-1',
        payload: { scannerId: 'scanner-1', codeType: 'qr', codeValue: 'VISITOR-123' },
        metadata: null,
    };

    beforeEach(async () => {
        mockEventLogService = { markProcessed: jest.fn().mockResolvedValue(undefined) };
        mockWsGateway = createMockWsGateway();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ScannerEventsService,
                { provide: InboundEventLogService, useValue: mockEventLogService },
                { provide: UsersGateway, useValue: mockWsGateway },
            ],
        }).compile();

        service = module.get<ScannerEventsService>(ScannerEventsService);
    });

    describe('processEvent', () => {
        it('should mark the log as processed', async () => {
            await service.processEvent(mockEvent, 'log-2');
            expect(mockEventLogService.markProcessed).toHaveBeenCalledWith('log-2');
        });

        it('should broadcast WS event to all clients', async () => {
            await service.processEvent(mockEvent, 'log-2');

            expect(mockWsGateway.broadcastToAll).toHaveBeenCalledWith(
                WsEvent.IntegrationsScannerEventReceived,
                {
                    eventType: 'scan_completed',
                    externalEventId: 'scan-001',
                    occurredAt: mockEvent.occurredAt,
                    sourceEntityId: 'scanner-1',
                },
            );
        });
    });
});
