import { Test, TestingModule } from '@nestjs/testing';
import { RetentionCleanupTask } from './retention-cleanup.task';
import { RetentionCleanupService } from '../settings/retention-cleanup.service';

describe('RetentionCleanupTask', () => {
    let task: RetentionCleanupTask;
    let mockCleanupService: Record<string, jest.Mock>;

    beforeEach(async () => {
        mockCleanupService = {
            handleRetentionCleanup: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RetentionCleanupTask,
                { provide: RetentionCleanupService, useValue: mockCleanupService },
            ],
        }).compile();

        task = module.get<RetentionCleanupTask>(RetentionCleanupTask);
    });

    it('should call handleRetentionCleanup when handleCron is invoked', async () => {
        await task.handleCron();
        expect(mockCleanupService.handleRetentionCleanup).toHaveBeenCalledTimes(1);
    });

    it('should not throw if cleanup service throws', async () => {
        mockCleanupService.handleRetentionCleanup.mockRejectedValue(new Error('DB down'));
        await expect(task.handleCron()).resolves.not.toThrow();
    });

    it('should allow subsequent runs after error', async () => {
        mockCleanupService.handleRetentionCleanup
            .mockRejectedValueOnce(new Error('first fails'))
            .mockResolvedValueOnce(undefined);

        await task.handleCron();
        await task.handleCron();
        expect(mockCleanupService.handleRetentionCleanup).toHaveBeenCalledTimes(2);
    });
});
