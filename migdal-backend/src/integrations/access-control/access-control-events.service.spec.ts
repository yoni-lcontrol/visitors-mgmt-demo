import { Test, TestingModule } from '@nestjs/testing';
import { AccessControlEventsService } from './access-control-events.service';
import { InboundEventLogService } from '../common/services/inbound-event-log.service';
import { UsersGateway } from '../../websocket/gateways/users.gateway';
import { WsEvent } from '../../websocket/enums/ws-events.enum';
import { IntegrationProvider } from '../common/enums/integration-provider.enum';
import { InboundEvent } from '../common/interfaces/inbound-event.interface';
import { createMockWsGateway } from '../../test-utils/mock.factory';

describe('AccessControlEventsService', () => {
    let service: AccessControlEventsService;
    let mockEventLogService: { markProcessed: jest.Mock };
    let mockWsGateway: ReturnType<typeof createMockWsGateway>;

    const mockEvent: InboundEvent = {
        provider: IntegrationProvider.AccessControl,
        externalEventId: 'evt-001',
        eventType: 'access_granted',
        occurredAt: new Date('2024-06-15T10:30:00Z'),
        sourceEntityId: 'door-1',
        payload: { doorId: 'door-1', cardNumber: '1234' },
        metadata: { correlationId: 'corr-1' },
    };

    beforeEach(async () => {
        mockEventLogService = { markProcessed: jest.fn().mockResolvedValue(undefined) };
        mockWsGateway = createMockWsGateway();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AccessControlEventsService,
                { provide: InboundEventLogService, useValue: mockEventLogService },
                { provide: UsersGateway, useValue: mockWsGateway },
            ],
        }).compile();

        service = module.get<AccessControlEventsService>(AccessControlEventsService);
    });

    describe('processEvent', () => {
        it('should mark the log as processed', async () => {
            await service.processEvent(mockEvent, 'log-1');
            expect(mockEventLogService.markProcessed).toHaveBeenCalledWith('log-1');
        });

        it('should broadcast WS event to all clients', async () => {
            await service.processEvent(mockEvent, 'log-1');

            expect(mockWsGateway.broadcastToAll).toHaveBeenCalledWith(
                WsEvent.IntegrationsAccessControlEventReceived,
                {
                    eventType: 'access_granted',
                    externalEventId: 'evt-001',
                    occurredAt: mockEvent.occurredAt,
                    sourceEntityId: 'door-1',
                },
            );
        });
    });
});
