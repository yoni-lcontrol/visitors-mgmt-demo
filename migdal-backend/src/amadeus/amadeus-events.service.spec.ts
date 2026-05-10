import { Test, TestingModule } from '@nestjs/testing';
import { AmadeusEventsService } from './amadeus-events.service';
import { InboundEventLogService } from '../integrations/common/services/inbound-event-log.service';
import { UsersGateway } from '../websocket/gateways/users.gateway';
import { WsEvent } from '../websocket/enums/ws-events.enum';
import { IntegrationProvider } from '../integrations/common/enums/integration-provider.enum';
import { InboundEvent } from '../integrations/common/interfaces/inbound-event.interface';
import { createMockWsGateway } from '../test-utils/mock.factory';

describe('AmadeusEventsService', () => {
    let service: AmadeusEventsService;
    let mockEventLogService: { markProcessed: jest.Mock; findRecentByProvider: jest.Mock; findByProviderPaginated: jest.Mock };
    let mockWsGateway: ReturnType<typeof createMockWsGateway>;

    const mockEvent: InboundEvent = {
        provider: IntegrationProvider.Amadeus,
        externalEventId: 'evt-001',
        eventType: 'Door.LegalCard',
        occurredAt: new Date('2024-06-15T10:30:00Z'),
        sourceEntityId: 'door-ext-1',
        payload: {
            internalEventType: 'Door.LegalCard',
            isActive: true,
            signalRMethod: 'AccessEventArrived',
            equipmentKind: 'Door',
            equipmentName: 'Main Entrance',
            controllerExternalId: 'ctrl-ext-1',
            cardholderFirstName: 'Dana',
            cardholderLastName: 'Levi',
            cardholderUid: 'ch-1',
            cardCode: 'CARD-555',
            rawPayloadJson: JSON.stringify({
                cardholderFirstName: 'Wrong',
                cardholderLastName: 'Name',
            }),
        },
        metadata: null,
    };

    beforeEach(async () => {
        mockEventLogService = {
            markProcessed: jest.fn().mockResolvedValue(undefined),
            findRecentByProvider: jest.fn().mockResolvedValue([]),
            findByProviderPaginated: jest.fn().mockResolvedValue({ items: [], total: 0 }),
        };
        mockWsGateway = createMockWsGateway();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AmadeusEventsService,
                { provide: InboundEventLogService, useValue: mockEventLogService },
                { provide: UsersGateway, useValue: mockWsGateway },
            ],
        }).compile();

        service = module.get<AmadeusEventsService>(AmadeusEventsService);
    });

    describe('processEvent', () => {
        it('should mark the log as processed', async () => {
            await service.processEvent(mockEvent, 'log-1');
            expect(mockEventLogService.markProcessed).toHaveBeenCalledWith('log-1');
        });

        it('should broadcast WS event with relevant fields', async () => {
            await service.processEvent(mockEvent, 'log-1');

            expect(mockWsGateway.broadcastToAll).toHaveBeenCalledWith(
                WsEvent.IntegrationsAmadeusEventReceived,
                expect.objectContaining({
                    eventType: 'Door.LegalCard',
                    externalEventId: 'evt-001',
                    occurredAt: mockEvent.occurredAt,
                    sourceEntityId: 'door-ext-1',
                    isActive: true,
                    signalRMethod: 'AccessEventArrived',
                    equipmentKind: 'Door',
                    equipmentName: 'Main Entrance',
                    controllerExternalId: 'ctrl-ext-1',
                    cardholderName: 'Dana Levi',
                    cardholderUid: 'ch-1',
                    cardCode: 'CARD-555',
                }),
            );
        });

        it('should handle events with minimal payload fields', async () => {
            const minimalEvent: InboundEvent = {
                provider: IntegrationProvider.Amadeus,
                externalEventId: 'evt-002',
                eventType: 'Amadeus.Generic',
                occurredAt: new Date('2024-06-15T10:30:00Z'),
                sourceEntityId: null,
                payload: {
                    internalEventType: 'Amadeus.Generic',
                    isActive: true,
                    signalRMethod: 'UnknownMethod',
                },
                metadata: null,
            };

            await service.processEvent(minimalEvent, 'log-2');

            expect(mockEventLogService.markProcessed).toHaveBeenCalledWith('log-2');
            expect(mockWsGateway.broadcastToAll).toHaveBeenCalledWith(
                WsEvent.IntegrationsAmadeusEventReceived,
                expect.objectContaining({
                    eventType: 'Amadeus.Generic',
                    externalEventId: 'evt-002',
                    sourceEntityId: null,
                }),
            );
        });
    });

    describe('getEvents', () => {
        it('should return paginated Amadeus events mapped from ExternalEventLogs', async () => {
            mockEventLogService.findByProviderPaginated.mockResolvedValue({
                items: [
                    {
                        id: 'log-1',
                        externalEventId: 'evt-100',
                        eventType: 'Door.LegalCard',
                        receivedAt: new Date('2024-06-15T10:31:00Z'),
                        payloadJson: JSON.stringify({
                            occurredUtc: '2024-06-15T10:30:00Z',
                            isActive: true,
                            signalRMethod: 'AccessEventArrived',
                            equipmentKind: 'Door',
                            equipmentName: 'Main Entrance',
                            controllerExternalId: 'ctrl-1',
                            cardholderFirstName: 'Dana',
                            cardholderLastName: 'Levi',
                            cardholderUid: 'ch-1',
                            cardCode: 'CARD-123',
                            rawPayloadJson: JSON.stringify({
                                cardholderFirstName: 'Wrong',
                                cardholderLastName: 'Name',
                            }),
                        }),
                    },
                ],
                total: 42,
            });

            const result = await service.getEvents(2, 25);

            expect(mockEventLogService.findByProviderPaginated).toHaveBeenCalledWith(IntegrationProvider.Amadeus, 2, 25);
            expect(result.page).toBe(2);
            expect(result.limit).toBe(25);
            expect(result.total).toBe(42);
            expect(result.totalPages).toBe(2);
            expect(result.items).toEqual([
                expect.objectContaining({
                    externalEventId: 'evt-100',
                    eventType: 'Door.LegalCard',
                    occurredAt: '2024-06-15T10:30:00Z',
                    equipmentName: 'Main Entrance',
                    cardholderName: 'Dana Levi',
                    cardCode: 'CARD-123',
                }),
            ]);
        });

        it('should tolerate invalid payload json and fall back to log fields', async () => {
            const receivedAt = new Date('2024-06-15T10:31:00Z');
            mockEventLogService.findByProviderPaginated.mockResolvedValue({
                items: [
                    {
                        id: 'log-2',
                        externalEventId: null,
                        eventType: 'Amadeus.Generic',
                        receivedAt,
                        payloadJson: '{invalid-json}',
                    },
                ],
                total: 1,
            });

            const result = await service.getEvents();

            expect(result.items[0]).toEqual(expect.objectContaining({
                externalEventId: 'log-2',
                eventType: 'Amadeus.Generic',
                occurredAt: receivedAt,
            }));
        });
    });
});
