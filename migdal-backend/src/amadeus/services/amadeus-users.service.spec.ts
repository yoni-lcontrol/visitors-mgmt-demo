import { Test, TestingModule } from '@nestjs/testing';
import { AmadeusUsersService } from './amadeus-users.service';
import { AccessControlApiService } from '../../access-control/services/ac-api.service';
import { AmadeusSyncQueueService } from './amadeus-sync-queue.service';
import { SyncQueueOperation, SyncQueueSource } from '../entities/amadeus-sync-queue.entity';

describe('AmadeusUsersService', () => {
    let service: AmadeusUsersService;
    let mockAcApi: Record<string, jest.Mock>;
    let mockSyncQueue: Record<string, jest.Mock>;

    beforeEach(async () => {
        mockAcApi = {
            createCardholder: jest.fn().mockResolvedValue({ success: true, cardholderId: 'ch-1' }),
            deleteCardholder: jest.fn().mockResolvedValue({ success: true }),
        };

        mockSyncQueue = {
            enqueueAndExecute: jest.fn().mockResolvedValue({ executed: true, queued: false }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AmadeusUsersService,
                { provide: AccessControlApiService, useValue: mockAcApi },
                { provide: AmadeusSyncQueueService, useValue: mockSyncQueue },
            ],
        }).compile();

        service = module.get<AmadeusUsersService>(AmadeusUsersService);
    });

    describe('addUserToAmadeus', () => {
        it('should enqueue create cardholder operation', async () => {
            const dto = {
                cardholderIdNumber: '123456789',
                firstName: 'John',
                lastName: 'Doe',
                fromDateValid: '2026-01-01T00:00:00Z',
                toDateValid: '2026-12-31T23:59:59Z',
                accessGroupApiKeys: ['group-1', 'group-2'],
                licensePlate: '12-345-67',
            };

            const result = await service.addUserToAmadeus(dto);

            expect(mockSyncQueue.enqueueAndExecute).toHaveBeenCalledWith({
                operation: SyncQueueOperation.CreateCardholder,
                source: SyncQueueSource.CardholderCrud,
                payload: {
                    personId: '123456789',
                    firstName: 'John',
                    lastName: 'Doe',
                    fromDate: '2026-01-01T00:00:00Z',
                    toDate: '2026-12-31T23:59:59Z',
                    accessLevelNames: ['group-1', 'group-2'],
                    licensePlate: '12-345-67',
                },
                personId: '123456789',
                referenceId: undefined,
                referenceType: undefined,
            });
            expect(result.success).toBe(true);
            expect(result.queued).toBe(false);
        });

        it('should return queued result when Amadeus is unavailable', async () => {
            mockSyncQueue.enqueueAndExecute.mockResolvedValue({
                executed: false,
                queued: true,
                queueId: 'q-123',
                error: 'Cannot reach Amadeus',
            });

            const result = await service.addUserToAmadeus({
                cardholderIdNumber: '123',
                firstName: 'John',
                lastName: 'Doe',
            });

            expect(result.success).toBe(false);
            expect(result.queued).toBe(true);
            expect(result.queueId).toBe('q-123');
        });

        it('should pass custom source when provided', async () => {
            const dto = {
                cardholderIdNumber: '987654321',
                firstName: 'Jane',
                lastName: 'Smith',
            };

            await service.addUserToAmadeus(dto, {
                source: SyncQueueSource.VisitorCheckIn,
                referenceId: 'visit-1',
                referenceType: 'Visit',
            });

            expect(mockSyncQueue.enqueueAndExecute).toHaveBeenCalledWith(
                expect.objectContaining({
                    source: SyncQueueSource.VisitorCheckIn,
                    referenceId: 'visit-1',
                    referenceType: 'Visit',
                }),
            );
        });
    });

    describe('deleteUserFromAmadeus', () => {
        it('should enqueue delete cardholder operation', async () => {
            const result = await service.deleteUserFromAmadeus('uid-abc-123');

            expect(mockSyncQueue.enqueueAndExecute).toHaveBeenCalledWith({
                operation: SyncQueueOperation.DeleteCardholder,
                source: SyncQueueSource.CardholderCrud,
                payload: { amadeusUid: 'uid-abc-123' },
                cardholderId: 'uid-abc-123',
                referenceId: undefined,
                referenceType: undefined,
            });
            expect(result.success).toBe(true);
            expect(result.queued).toBe(false);
        });

        it('should return queued result when Amadeus is unavailable', async () => {
            mockSyncQueue.enqueueAndExecute.mockResolvedValue({
                executed: false,
                queued: true,
                queueId: 'q-456',
                error: 'ECONNREFUSED',
            });

            const result = await service.deleteUserFromAmadeus('uid-abc-123');

            expect(result.success).toBe(false);
            expect(result.queued).toBe(true);
            expect(result.queueId).toBe('q-456');
        });
    });
});
