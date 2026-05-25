import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AmadeusSyncQueueService } from './amadeus-sync-queue.service';
import { AmadeusSyncQueue, SyncQueueOperation, SyncQueueStatus, SyncQueueSource } from '../entities/amadeus-sync-queue.entity';
import { AccessControlApiService } from '../../access-control/services/ac-api.service';
import { BadGatewayException } from '@nestjs/common';

describe('AmadeusSyncQueueService', () => {
    let service: AmadeusSyncQueueService;
    let repo: jest.Mocked<Repository<AmadeusSyncQueue>>;
    let acApi: jest.Mocked<AccessControlApiService>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AmadeusSyncQueueService,
                {
                    provide: getRepositoryToken(AmadeusSyncQueue),
                    useValue: {
                        create: jest.fn(),
                        save: jest.fn(),
                        find: jest.fn(),
                        findOne: jest.fn(),
                        findAndCount: jest.fn(),
                        update: jest.fn(),
                        createQueryBuilder: jest.fn(),
                    },
                },
                {
                    provide: AccessControlApiService,
                    useValue: {
                        createCardholder: jest.fn(),
                        updateCardholder: jest.fn(),
                        deleteCardholder: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<AmadeusSyncQueueService>(AmadeusSyncQueueService);
        repo = module.get(getRepositoryToken(AmadeusSyncQueue));
        acApi = module.get(AccessControlApiService);
    });

    describe('enqueueAndExecute', () => {
        const payload = {
            personId: 'TEST-123',
            firstName: 'John',
            lastName: 'Doe',
            accessLevelNames: ['Visitors'],
        };

        it('should execute immediately when Amadeus is available', async () => {
            const entry = {
                id: 'queue-1',
                status: SyncQueueStatus.InProgress,
                operation: SyncQueueOperation.CreateCardholder,
                payload: JSON.stringify(payload),
            } as AmadeusSyncQueue;
            repo.create.mockReturnValue(entry);
            repo.save.mockResolvedValue(entry);
            acApi.createCardholder.mockResolvedValue({ success: true, cardholderId: 'ch-1' });

            const result = await service.enqueueAndExecute({
                operation: SyncQueueOperation.CreateCardholder,
                source: SyncQueueSource.VisitorCheckIn,
                payload,
                personId: 'TEST-123',
            });

            expect(result.executed).toBe(true);
            expect(result.queued).toBe(false);
            expect(acApi.createCardholder).toHaveBeenCalledWith(payload);
            expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({
                status: SyncQueueStatus.Completed,
            }));
        });

        it('should queue when Amadeus is unavailable', async () => {
            const entry = {
                id: 'queue-2',
                status: SyncQueueStatus.InProgress,
                operation: SyncQueueOperation.CreateCardholder,
                payload: JSON.stringify(payload),
                retryCount: 0,
            } as AmadeusSyncQueue;
            repo.create.mockReturnValue(entry);
            repo.save.mockResolvedValue(entry);
            acApi.createCardholder.mockRejectedValue(new BadGatewayException('Cannot reach Amadeus service (ECONNREFUSED)'));

            const result = await service.enqueueAndExecute({
                operation: SyncQueueOperation.CreateCardholder,
                source: SyncQueueSource.VisitorCheckIn,
                payload,
                personId: 'TEST-123',
            });

            expect(result.executed).toBe(false);
            expect(result.queued).toBe(true);
            expect(result.queueId).toBe('queue-2');
            expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({
                status: SyncQueueStatus.Pending,
            }));
        });
    });

    describe('processQueue', () => {
        it('should process pending items and mark as completed', async () => {
            const entry = {
                id: 'queue-3',
                operation: SyncQueueOperation.CreateCardholder,
                payload: JSON.stringify({ personId: 'TEST-456', firstName: 'Jane', lastName: 'Doe' }),
                status: SyncQueueStatus.Pending,
                retryCount: 0,
                maxRetries: 10,
            } as AmadeusSyncQueue;

            repo.find.mockResolvedValue([entry]);
            repo.save.mockResolvedValue(entry);
            acApi.createCardholder.mockResolvedValue({ success: true, cardholderId: 'ch-2' });

            const result = await service.processQueue();

            expect(result.succeeded).toBe(1);
            expect(result.failed).toBe(0);
            expect(acApi.createCardholder).toHaveBeenCalled();
        });

        it('should stop processing on connection error', async () => {
            const entries = [
                { id: 'q1', operation: SyncQueueOperation.CreateCardholder, payload: '{}', status: SyncQueueStatus.Pending, retryCount: 0, maxRetries: 10 },
                { id: 'q2', operation: SyncQueueOperation.CreateCardholder, payload: '{}', status: SyncQueueStatus.Pending, retryCount: 0, maxRetries: 10 },
            ] as AmadeusSyncQueue[];

            repo.find.mockResolvedValue(entries);
            repo.save.mockResolvedValue(entries[0]);
            const connError = new Error('Cannot reach Amadeus service (ECONNREFUSED)');
            (connError as any).code = 'ECONNREFUSED';
            acApi.createCardholder.mockRejectedValue(connError);

            const result = await service.processQueue();

            // Should stop after first failure (connection error)
            expect(result.failed).toBe(1);
            expect(acApi.createCardholder).toHaveBeenCalledTimes(1);
        });

        it('should mark as failed when max retries exceeded', async () => {
            const entry = {
                id: 'queue-4',
                operation: SyncQueueOperation.CreateCardholder,
                payload: JSON.stringify({ personId: 'TEST-789' }),
                status: SyncQueueStatus.Pending,
                retryCount: 9,
                maxRetries: 10,
            } as AmadeusSyncQueue;

            repo.find.mockResolvedValue([entry]);
            repo.save.mockResolvedValue(entry);
            acApi.createCardholder.mockRejectedValue(new Error('Server error'));

            await service.processQueue();

            expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({
                status: SyncQueueStatus.Failed,
            }));
        });
    });

    describe('retryItem', () => {
        it('should retry a specific item', async () => {
            const entry = {
                id: 'queue-5',
                operation: SyncQueueOperation.DeleteCardholder,
                payload: JSON.stringify({ amadeusUid: 'uid-123' }),
                status: SyncQueueStatus.Failed,
                retryCount: 5,
                maxRetries: 10,
                isActive: true,
            } as AmadeusSyncQueue;

            repo.findOne.mockResolvedValue(entry);
            repo.save.mockResolvedValue(entry);
            acApi.deleteCardholder.mockResolvedValue({ success: true });

            const result = await service.retryItem('queue-5');

            expect(result.success).toBe(true);
            expect(acApi.deleteCardholder).toHaveBeenCalledWith('uid-123');
        });
    });

    describe('cancelItem', () => {
        it('should cancel a pending item', async () => {
            const entry = {
                id: 'queue-6',
                status: SyncQueueStatus.Pending,
                isActive: true,
            } as AmadeusSyncQueue;

            repo.findOne.mockResolvedValue(entry);
            repo.save.mockResolvedValue(entry);

            const result = await service.cancelItem('queue-6');

            expect(result.success).toBe(true);
            expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({
                status: SyncQueueStatus.Cancelled,
            }));
        });

        it('should not cancel a completed item', async () => {
            const entry = {
                id: 'queue-7',
                status: SyncQueueStatus.Completed,
                isActive: true,
            } as AmadeusSyncQueue;

            repo.findOne.mockResolvedValue(entry);

            const result = await service.cancelItem('queue-7');

            expect(result.success).toBe(false);
        });
    });

    describe('retryAllFailed', () => {
        it('should reset all failed items to pending', async () => {
            repo.update.mockResolvedValue({ affected: 3, raw: [], generatedMaps: [] });

            const result = await service.retryAllFailed();

            expect(result.count).toBe(3);
            expect(repo.update).toHaveBeenCalledWith(
                { status: SyncQueueStatus.Failed, isActive: true },
                expect.objectContaining({ status: SyncQueueStatus.Pending, retryCount: 0 }),
            );
        });
    });
});
