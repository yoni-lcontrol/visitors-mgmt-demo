import { Test, TestingModule } from '@nestjs/testing';
import { AmadeusEventsController } from './amadeus-events.controller';
import { AmadeusEventsService } from './amadeus-events.service';
import { AmadeusEventAdapter } from './adapters/amadeus-event.adapter';
import { InboundEventLogService } from '../integrations/common/services/inbound-event-log.service';
import { IntegrationProvider } from '../integrations/common/enums/integration-provider.enum';
import { InboundEvent } from '../integrations/common/interfaces/inbound-event.interface';
import { BadRequestException } from '@nestjs/common';

describe('AmadeusEventsController', () => {
    let controller: AmadeusEventsController;
    let mockAdapter: { toCanonical: jest.Mock };
    let mockEventsService: { processEvent: jest.Mock; getRecentEvents: jest.Mock };
    let mockEventLogService: {
        isDuplicate: jest.Mock;
        createLog: jest.Mock;
        markFailed: jest.Mock;
    };

    const makeCanonicalEvent = (externalEventId: string): InboundEvent => ({
        provider: IntegrationProvider.Amadeus,
        externalEventId,
        eventType: 'Door.LegalCard',
        occurredAt: new Date('2024-06-15T10:30:00Z'),
        sourceEntityId: 'door-ext-1',
        payload: { internalEventType: 'Door.LegalCard', isActive: true },
        metadata: null,
    });

    const makeDto = (id: string) => ({
        sourceSystem: 'Amadeus8',
        signalRMethod: 'AccessEventArrived',
        internalEventType: 'Door.LegalCard',
        isActive: true,
        occurredUtc: '2024-06-15T10:30:00Z',
        receivedUtc: '2024-06-15T10:30:01Z',
        externalEventId: id,
        rawPayloadJson: '{}',
    });

    beforeEach(async () => {
        mockAdapter = {
            toCanonical: jest.fn().mockImplementation((dto: any) =>
                makeCanonicalEvent(dto.externalEventId ?? 'unknown'),
            ),
        };
        mockEventsService = {
            processEvent: jest.fn().mockResolvedValue(undefined),
            getRecentEvents: jest.fn().mockResolvedValue([]),
        };
        mockEventLogService = {
            isDuplicate: jest.fn().mockResolvedValue(false),
            createLog: jest.fn().mockResolvedValue({ id: 'log-1' }),
            markFailed: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [AmadeusEventsController],
            providers: [
                { provide: AmadeusEventAdapter, useValue: mockAdapter },
                { provide: AmadeusEventsService, useValue: mockEventsService },
                { provide: InboundEventLogService, useValue: mockEventLogService },
            ],
        }).compile();

        controller = module.get<AmadeusEventsController>(AmadeusEventsController);
    });

    describe('receiveEvents', () => {
        it('should process a batch of events and return results', async () => {
            const dtos = [makeDto('evt-1'), makeDto('evt-2')];

            const result = await controller.receiveEvents(dtos as any);

            expect(result.received).toBe(2);
            expect(result.results).toHaveLength(2);
            expect(result.results[0].status).toBe('processed');
            expect(result.results[1].status).toBe('processed');
            expect(mockAdapter.toCanonical).toHaveBeenCalledTimes(2);
            expect(mockEventsService.processEvent).toHaveBeenCalledTimes(2);
        });

        it('should return duplicate status for duplicate events', async () => {
            mockEventLogService.isDuplicate
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(true);

            const dtos = [makeDto('evt-1'), makeDto('evt-dup')];

            const result = await controller.receiveEvents(dtos as any);

            expect(result.results[0].status).toBe('processed');
            expect(result.results[1].status).toBe('duplicate');
            expect(mockEventsService.processEvent).toHaveBeenCalledTimes(1);
        });

        it('should return failed status for events that throw during processing', async () => {
            mockEventsService.processEvent
                .mockResolvedValueOnce(undefined)
                .mockRejectedValueOnce(new Error('DB connection lost'));

            const dtos = [makeDto('evt-1'), makeDto('evt-2')];

            const result = await controller.receiveEvents(dtos as any);

            expect(result.results[0].status).toBe('processed');
            expect(result.results[1].status).toBe('failed');
            expect(result.results[1].error).toBe('DB connection lost');
        });

        it('should handle empty batch', async () => {
            const result = await controller.receiveEvents([]);

            expect(result.received).toBe(0);
            expect(result.results).toEqual([]);
        });

        it('should throw BadRequestException for non-array body', async () => {
            await expect(
                controller.receiveEvents('not-an-array' as any),
            ).rejects.toThrow(BadRequestException);
        });

        it('should handle non-Error exceptions gracefully', async () => {
            mockEventsService.processEvent.mockRejectedValue('string error');

            const dtos = [makeDto('evt-1')];

            const result = await controller.receiveEvents(dtos as any);

            expect(result.results[0].status).toBe('failed');
            expect(result.results[0].error).toBe('Unknown error');
        });

        it('should continue processing remaining events after one fails', async () => {
            mockEventsService.processEvent
                .mockRejectedValueOnce(new Error('Transient failure'))
                .mockResolvedValueOnce(undefined);

            const dtos = [makeDto('evt-1'), makeDto('evt-2')];

            const result = await controller.receiveEvents(dtos as any);

            expect(result.received).toBe(2);
            expect(result.results[0].status).toBe('failed');
            expect(result.results[1].status).toBe('processed');
        });
    });

    describe('getRecentEvents', () => {
        it('should return recent Amadeus events from the service', async () => {
            const events = [{ externalEventId: 'evt-1', eventType: 'Door.LegalCard' }];
            mockEventsService.getRecentEvents.mockResolvedValue(events);

            const result = await controller.getRecentEvents(100);

            expect(result).toEqual(events);
            expect(mockEventsService.getRecentEvents).toHaveBeenCalledWith(100);
        });
    });
});
