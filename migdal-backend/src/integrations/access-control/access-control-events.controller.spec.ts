import { Test, TestingModule } from '@nestjs/testing';
import { AccessControlEventsController } from './access-control-events.controller';
import { AccessControlEventsService } from './access-control-events.service';
import { AccessControlEventAdapter } from './adapters/access-control-event.adapter';
import { InboundEventLogService } from '../common/services/inbound-event-log.service';
import { IntegrationAuthService } from '../common/services/integration-auth.service';
import { IntegrationHmacGuard } from '../common/guards/integration-hmac.guard';
import { IntegrationProvider } from '../common/enums/integration-provider.enum';
import { InboundEvent } from '../common/interfaces/inbound-event.interface';

describe('AccessControlEventsController', () => {
    let controller: AccessControlEventsController;
    let mockAdapter: { toCanonical: jest.Mock };
    let mockEventsService: { processEvent: jest.Mock };
    let mockEventLogService: {
        isDuplicate: jest.Mock;
        createLog: jest.Mock;
        markFailed: jest.Mock;
    };

    const mockCanonicalEvent: InboundEvent = {
        provider: IntegrationProvider.AccessControl,
        externalEventId: 'evt-001',
        eventType: 'access_granted',
        occurredAt: new Date('2024-06-15T10:30:00Z'),
        sourceEntityId: 'door-1',
        payload: { doorId: 'door-1' },
        metadata: null,
    };

    const mockRequest = {
        integrationClient: { clientId: 'client-1', provider: 'access-control', secret: 's', enabled: true },
        headers: { 'x-signature': 'sig-abc' },
    } as any;

    beforeEach(async () => {
        mockAdapter = { toCanonical: jest.fn().mockReturnValue(mockCanonicalEvent) };
        mockEventsService = { processEvent: jest.fn().mockResolvedValue(undefined) };
        mockEventLogService = {
            isDuplicate: jest.fn().mockResolvedValue(false),
            createLog: jest.fn().mockResolvedValue({ id: 'log-1' }),
            markFailed: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [AccessControlEventsController],
            providers: [
                { provide: AccessControlEventAdapter, useValue: mockAdapter },
                { provide: AccessControlEventsService, useValue: mockEventsService },
                { provide: InboundEventLogService, useValue: mockEventLogService },
                { provide: IntegrationAuthService, useValue: {} },
                { provide: IntegrationHmacGuard, useValue: { canActivate: () => true } },
            ],
        }).compile();

        controller = module.get<AccessControlEventsController>(AccessControlEventsController);
    });

    describe('receiveEvent', () => {
        const dto = {
            eventId: 'evt-001',
            eventType: 'access_granted',
            occurredAt: '2024-06-15T10:30:00Z',
            doorId: 'door-1',
        };

        it('should process event and return processed status', async () => {
            const result = await controller.receiveEvent(dto as any, mockRequest);

            expect(mockAdapter.toCanonical).toHaveBeenCalledWith(dto);
            expect(mockEventLogService.isDuplicate).toHaveBeenCalledWith(
                IntegrationProvider.AccessControl,
                'evt-001',
            );
            expect(mockEventLogService.createLog).toHaveBeenCalledWith('client-1', 'sig-abc', mockCanonicalEvent);
            expect(mockEventsService.processEvent).toHaveBeenCalledWith(mockCanonicalEvent, 'log-1');
            expect(result).toEqual({ status: 'processed', eventId: 'log-1' });
        });

        it('should return duplicate status without processing', async () => {
            mockEventLogService.isDuplicate.mockResolvedValue(true);

            const result = await controller.receiveEvent(dto as any, mockRequest);

            expect(result).toEqual({ status: 'duplicate', eventId: 'evt-001' });
            expect(mockEventLogService.createLog).not.toHaveBeenCalled();
            expect(mockEventsService.processEvent).not.toHaveBeenCalled();
        });

        it('should return failed status on processing error', async () => {
            mockEventsService.processEvent.mockRejectedValue(new Error('Processing failed'));

            const result = await controller.receiveEvent(dto as any, mockRequest);

            expect(result).toEqual({ status: 'failed', eventId: 'log-1' });
            expect(mockEventLogService.markFailed).toHaveBeenCalledWith('log-1', 'Processing failed');
        });

        it('should handle non-Error exceptions', async () => {
            mockEventsService.processEvent.mockRejectedValue('string error');

            const result = await controller.receiveEvent(dto as any, mockRequest);

            expect(result).toEqual({ status: 'failed', eventId: 'log-1' });
            expect(mockEventLogService.markFailed).toHaveBeenCalledWith('log-1', 'Unknown error');
        });
    });
});
