import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { AdSyncTask } from './ad-sync.task';
import { AD_SYNC_QUEUE } from '../users/ad-sync.processor';
import { AdSyncService } from '../users/ad-sync.service';

describe('AdSyncTask', () => {
    let task: AdSyncTask;
    let mockQueue: any;
    let mockAdSyncService: Record<string, jest.Mock>;

    beforeEach(async () => {
        mockQueue = {
            add: jest.fn().mockResolvedValue({ id: 'job-1' }),
            getJobs: jest.fn().mockResolvedValue([]),
            client: Promise.resolve({}),
        };

        mockAdSyncService = {
            syncAll: jest.fn().mockResolvedValue({ totalCreated: 0, totalUpdated: 0 }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AdSyncTask,
                { provide: getQueueToken(AD_SYNC_QUEUE), useValue: mockQueue },
                { provide: AdSyncService, useValue: mockAdSyncService },
            ],
        }).compile();

        task = module.get<AdSyncTask>(AdSyncTask);
    });

    it('should queue a sync job when handleCron is invoked', async () => {
        await task.handleCron();
        expect(mockQueue.add).toHaveBeenCalledWith(
            'sync-all',
            { triggeredBy: undefined },
            expect.objectContaining({ jobId: expect.stringContaining('ad-sync-scheduled-') }),
        );
    });

    it('should not queue a job if one is already active', async () => {
        mockQueue.getJobs.mockResolvedValue([{ id: 'existing-job' }]);
        await task.handleCron();
        expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should not queue a job if one is waiting', async () => {
        mockQueue.getJobs.mockResolvedValue([{ id: 'waiting-job' }]);
        await task.handleCron();
        expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should queue a job when no active or waiting jobs exist', async () => {
        mockQueue.getJobs.mockResolvedValue([]);
        await task.handleCron();
        expect(mockQueue.add).toHaveBeenCalledTimes(1);
    });

    it('should fall back to direct sync when Redis is unavailable', async () => {
        mockQueue.client = Promise.reject(new Error('Redis connection refused'));
        await task.handleCron();
        expect(mockQueue.add).not.toHaveBeenCalled();
        expect(mockAdSyncService.syncAll).toHaveBeenCalled();
    });

    it('should fall back to direct sync when queue is not injected', async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AdSyncTask,
                { provide: getQueueToken(AD_SYNC_QUEUE), useValue: undefined },
                { provide: AdSyncService, useValue: mockAdSyncService },
            ],
        }).compile();

        const taskWithoutQueue = module.get<AdSyncTask>(AdSyncTask);
        await taskWithoutQueue.handleCron();
        expect(mockAdSyncService.syncAll).toHaveBeenCalled();
    });
});
