import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InboundEventLogService } from './inbound-event-log.service';
import { ExternalEventLog } from '../entities/external-event-log.entity';
import { InboundEventStatus } from '../enums/inbound-event-status.enum';
import { IntegrationProvider } from '../enums/integration-provider.enum';
import { InboundEvent } from '../interfaces/inbound-event.interface';
import { createMockRepository } from '../../../test-utils/mock.factory';

describe('InboundEventLogService', () => {
    let service: InboundEventLogService;
    let mockRepo: ReturnType<typeof createMockRepository>;

    const mockEvent: InboundEvent = {
        provider: IntegrationProvider.AccessControl,
        externalEventId: 'ext-123',
        eventType: 'access_granted',
        occurredAt: new Date('2024-01-01T00:00:00Z'),
        sourceEntityId: 'door-1',
        payload: { doorId: 'door-1', cardNumber: '1234' },
        metadata: { correlationId: 'corr-1' },
    };

    beforeEach(async () => {
        mockRepo = createMockRepository();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                InboundEventLogService,
                { provide: getRepositoryToken(ExternalEventLog), useValue: mockRepo },
            ],
        }).compile();

        service = module.get<InboundEventLogService>(InboundEventLogService);
    });

    describe('createLog', () => {
        it('should create and save an event log', async () => {
            mockRepo.save.mockResolvedValue({ id: 'log-1', provider: IntegrationProvider.AccessControl });

            const result = await service.createLog('client-1', 'sig-abc', mockEvent);

            expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                provider: IntegrationProvider.AccessControl,
                clientId: 'client-1',
                externalEventId: 'ext-123',
                eventType: 'access_granted',
                signature: 'sig-abc',
                status: InboundEventStatus.Received,
            }));
            expect(mockRepo.save).toHaveBeenCalled();
            expect(result.id).toBe('log-1');
        });

        it('should serialize payload as JSON string', async () => {
            mockRepo.save.mockResolvedValue({ id: 'log-1' });

            await service.createLog('client-1', 'sig', mockEvent);

            expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                payloadJson: JSON.stringify(mockEvent.payload),
            }));
        });
    });

    describe('isDuplicate', () => {
        it('should return true when event with same provider+externalEventId exists', async () => {
            mockRepo.findOne.mockResolvedValue({ id: 'existing' });

            const result = await service.isDuplicate(IntegrationProvider.AccessControl, 'ext-123');

            expect(result).toBe(true);
            expect(mockRepo.findOne).toHaveBeenCalledWith({
                where: { provider: IntegrationProvider.AccessControl, externalEventId: 'ext-123' },
            });
        });

        it('should return false when no existing event found', async () => {
            mockRepo.findOne.mockResolvedValue(null);

            const result = await service.isDuplicate(IntegrationProvider.AccessControl, 'ext-new');

            expect(result).toBe(false);
        });

        it('should return false when externalEventId is empty', async () => {
            const result = await service.isDuplicate(IntegrationProvider.AccessControl, '');

            expect(result).toBe(false);
            expect(mockRepo.findOne).not.toHaveBeenCalled();
        });
    });

    describe('markProcessed', () => {
        it('should update status to processed with processedAt timestamp', async () => {
            await service.markProcessed('log-1');

            expect(mockRepo.update).toHaveBeenCalledWith('log-1', expect.objectContaining({
                status: InboundEventStatus.Processed,
                processedAt: expect.any(Date),
            }));
        });
    });

    describe('markDuplicate', () => {
        it('should update status to duplicate', async () => {
            await service.markDuplicate('log-1');

            expect(mockRepo.update).toHaveBeenCalledWith('log-1', expect.objectContaining({
                status: InboundEventStatus.Duplicate,
                processedAt: expect.any(Date),
            }));
        });
    });

    describe('markFailed', () => {
        it('should update status to failed with error message', async () => {
            await service.markFailed('log-1', 'Something went wrong');

            expect(mockRepo.update).toHaveBeenCalledWith('log-1', expect.objectContaining({
                status: InboundEventStatus.Failed,
                errorMessage: 'Something went wrong',
                processedAt: expect.any(Date),
            }));
        });
    });

    describe('markIgnored', () => {
        it('should update status to ignored with reason', async () => {
            await service.markIgnored('log-1', 'Not relevant');

            expect(mockRepo.update).toHaveBeenCalledWith('log-1', expect.objectContaining({
                status: InboundEventStatus.Ignored,
                errorMessage: 'Not relevant',
                processedAt: expect.any(Date),
            }));
        });
    });
});
