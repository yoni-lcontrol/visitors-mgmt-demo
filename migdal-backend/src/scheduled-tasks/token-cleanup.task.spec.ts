import { Test, TestingModule } from '@nestjs/testing';
import { TokenCleanupTask } from './token-cleanup.task';
import { AuthService } from '../auth/auth.service';

describe('TokenCleanupTask', () => {
    let task: TokenCleanupTask;
    let mockAuthService: Record<string, jest.Mock>;

    beforeEach(async () => {
        mockAuthService = {
            cleanupExpiredTokens: jest.fn().mockResolvedValue(5),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TokenCleanupTask,
                { provide: AuthService, useValue: mockAuthService },
            ],
        }).compile();

        task = module.get<TokenCleanupTask>(TokenCleanupTask);
    });

    it('should call cleanupExpiredTokens when handleCron is invoked', async () => {
        await task.handleCron();
        expect(mockAuthService.cleanupExpiredTokens).toHaveBeenCalledTimes(1);
    });

    it('should not throw if auth service throws', async () => {
        mockAuthService.cleanupExpiredTokens.mockRejectedValue(new Error('DB down'));
        await expect(task.handleCron()).resolves.not.toThrow();
    });

    it('should allow subsequent runs after error', async () => {
        mockAuthService.cleanupExpiredTokens
            .mockRejectedValueOnce(new Error('first fails'))
            .mockResolvedValueOnce(3);

        await task.handleCron();
        await task.handleCron();
        expect(mockAuthService.cleanupExpiredTokens).toHaveBeenCalledTimes(2);
    });
});
