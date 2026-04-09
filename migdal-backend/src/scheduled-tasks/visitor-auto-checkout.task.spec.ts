import { Test, TestingModule } from '@nestjs/testing';
import { VisitorAutoCheckoutTask } from './visitor-auto-checkout.task';
import { VisitStatusService } from '../visitors/visit-status.service';

describe('VisitorAutoCheckoutTask', () => {
    let task: VisitorAutoCheckoutTask;
    let mockVisitStatusService: Record<string, jest.Mock>;

    beforeEach(async () => {
        mockVisitStatusService = {
            autoCheckOutExpiredVisitors: jest.fn().mockResolvedValue({ checkedOut: 0 }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                VisitorAutoCheckoutTask,
                { provide: VisitStatusService, useValue: mockVisitStatusService },
            ],
        }).compile();

        task = module.get<VisitorAutoCheckoutTask>(VisitorAutoCheckoutTask);
    });

    it('should call autoCheckOutExpiredVisitors when handleCron is invoked', async () => {
        await task.handleCron();
        expect(mockVisitStatusService.autoCheckOutExpiredVisitors).toHaveBeenCalledTimes(1);
    });

    it('should not throw if service throws', async () => {
        mockVisitStatusService.autoCheckOutExpiredVisitors.mockRejectedValue(new Error('DB down'));
        await expect(task.handleCron()).resolves.not.toThrow();
    });

    it('should skip if already running', async () => {
        let resolve: () => void;
        const blockingPromise = new Promise<{ checkedOut: number }>((r) => {
            resolve = () => r({ checkedOut: 5 });
        });
        mockVisitStatusService.autoCheckOutExpiredVisitors.mockReturnValue(blockingPromise);

        const first = task.handleCron();
        await task.handleCron(); // should skip

        resolve!();
        await first;

        expect(mockVisitStatusService.autoCheckOutExpiredVisitors).toHaveBeenCalledTimes(1);
    });

    it('should reset running flag after completion', async () => {
        await task.handleCron();
        expect(task.isRunning()).toBe(false);
    });

    it('should reset running flag after error', async () => {
        mockVisitStatusService.autoCheckOutExpiredVisitors.mockRejectedValue(new Error('fail'));
        await task.handleCron();
        expect(task.isRunning()).toBe(false);
    });
});
