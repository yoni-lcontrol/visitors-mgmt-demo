import { Test, TestingModule } from '@nestjs/testing';
import { AdSyncTask } from './ad-sync.task';
import { AdSyncService, AdSyncResult } from '../users/ad-sync.service';

describe('AdSyncTask', () => {
    let task: AdSyncTask;
    let mockSyncService: Record<string, jest.Mock>;

    const mockResult: AdSyncResult = {
        configsProcessed: 1,
        configsFailed: 0,
        totalFetched: 5,
        totalCreated: 2,
        totalUpdated: 3,
        totalDeactivated: 0,
        totalSkipped: 0,
        details: [],
        durationMs: 500,
    };

    beforeEach(async () => {
        mockSyncService = {
            syncAll: jest.fn().mockResolvedValue(mockResult),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AdSyncTask,
                { provide: AdSyncService, useValue: mockSyncService },
            ],
        }).compile();

        task = module.get<AdSyncTask>(AdSyncTask);
    });

    it('should call syncAll when handleCron is invoked', async () => {
        await task.handleCron();
        expect(mockSyncService.syncAll).toHaveBeenCalledTimes(1);
    });

    it('should not call syncAll with triggeredBy', async () => {
        await task.handleCron();
        expect(mockSyncService.syncAll).toHaveBeenCalledWith();
    });

    it('should prevent overlapping runs', async () => {
        let resolveFirst: () => void;
        const firstCall = new Promise<AdSyncResult>((resolve) => {
            resolveFirst = () => resolve(mockResult);
        });
        mockSyncService.syncAll.mockReturnValueOnce(firstCall);

        const run1 = task.handleCron();
        expect(task.isRunning()).toBe(true);

        await task.handleCron();
        expect(mockSyncService.syncAll).toHaveBeenCalledTimes(1);

        resolveFirst!();
        await run1;
        expect(task.isRunning()).toBe(false);
    });

    it('should reset running flag after successful completion', async () => {
        await task.handleCron();
        expect(task.isRunning()).toBe(false);
    });

    it('should reset running flag even if sync throws', async () => {
        mockSyncService.syncAll.mockRejectedValue(new Error('catastrophic failure'));
        await task.handleCron();
        expect(task.isRunning()).toBe(false);
    });

    it('should allow subsequent runs after error', async () => {
        mockSyncService.syncAll
            .mockRejectedValueOnce(new Error('first fails'))
            .mockResolvedValueOnce(mockResult);

        await task.handleCron();
        expect(task.isRunning()).toBe(false);

        await task.handleCron();
        expect(mockSyncService.syncAll).toHaveBeenCalledTimes(2);
    });

    it('should report running status correctly', () => {
        expect(task.isRunning()).toBe(false);
    });
});
