import { Test, TestingModule } from '@nestjs/testing';
import { BlacklistExpiryTask } from './blacklist-expiry.task';
import { BlacklistService } from '../visitors/blacklist.service';

describe('BlacklistExpiryTask', () => {
    let task: BlacklistExpiryTask;
    let mockBlacklistService: Record<string, jest.Mock>;

    beforeEach(async () => {
        mockBlacklistService = {
            removeExpired: jest.fn().mockResolvedValue(0),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BlacklistExpiryTask,
                { provide: BlacklistService, useValue: mockBlacklistService },
            ],
        }).compile();

        task = module.get<BlacklistExpiryTask>(BlacklistExpiryTask);
    });

    it('should call removeExpired when handleCron is invoked', async () => {
        await task.handleCron();
        expect(mockBlacklistService.removeExpired).toHaveBeenCalledTimes(1);
    });

    it('should not throw if removeExpired throws', async () => {
        mockBlacklistService.removeExpired.mockRejectedValue(new Error('DB down'));
        await expect(task.handleCron()).resolves.not.toThrow();
    });

    it('should allow subsequent runs after error', async () => {
        mockBlacklistService.removeExpired
            .mockRejectedValueOnce(new Error('first fails'))
            .mockResolvedValueOnce(3);

        await task.handleCron();
        await task.handleCron();
        expect(mockBlacklistService.removeExpired).toHaveBeenCalledTimes(2);
    });
});
