import { Test, TestingModule } from '@nestjs/testing';
import { AdSyncProcessor } from './ad-sync.processor';
import { AdSyncService, AdSyncResult } from './ad-sync.service';

describe('AdSyncProcessor', () => {
    let processor: AdSyncProcessor;
    let mockAdSyncService: Record<string, jest.Mock>;

    const mockResult: AdSyncResult = {
        configsProcessed: 1,
        configsFailed: 0,
        totalFetched: 100,
        totalCreated: 50,
        totalUpdated: 30,
        totalDeactivated: 5,
        totalSkipped: 15,
        details: [],
        durationMs: 5000,
    };

    beforeEach(async () => {
        mockAdSyncService = {
            syncAll: jest.fn().mockResolvedValue(mockResult),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AdSyncProcessor,
                { provide: AdSyncService, useValue: mockAdSyncService },
            ],
        }).compile();

        processor = module.get<AdSyncProcessor>(AdSyncProcessor);
    });

    it('should call adSyncService.syncAll with triggeredBy from job data', async () => {
        const mockJob = {
            id: 'job-1',
            data: { triggeredBy: 'user-123' },
        } as any;

        const result = await processor.process(mockJob);
        expect(mockAdSyncService.syncAll).toHaveBeenCalledWith('user-123');
        expect(result).toEqual(mockResult);
    });

    it('should call adSyncService.syncAll with undefined triggeredBy', async () => {
        const mockJob = {
            id: 'job-2',
            data: {},
        } as any;

        await processor.process(mockJob);
        expect(mockAdSyncService.syncAll).toHaveBeenCalledWith(undefined);
    });

    it('should propagate errors from syncAll', async () => {
        mockAdSyncService.syncAll.mockRejectedValue(new Error('sync failed'));

        const mockJob = {
            id: 'job-3',
            data: { triggeredBy: 'user-123' },
        } as any;

        await expect(processor.process(mockJob)).rejects.toThrow('sync failed');
    });

    it('should return the sync result', async () => {
        const mockJob = {
            id: 'job-4',
            data: {},
        } as any;

        const result = await processor.process(mockJob);
        expect(result.configsProcessed).toBe(1);
        expect(result.totalCreated).toBe(50);
        expect(result.durationMs).toBe(5000);
    });
});
