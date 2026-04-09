import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { VisitStatusService } from '../visitors/visit-status.service';

@Injectable()
export class VisitorAutoCheckoutTask {
    private readonly logger = new Logger(VisitorAutoCheckoutTask.name);
    private running = false;

    constructor(private readonly statusService: VisitStatusService) { }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: 'visitor-auto-checkout' })
    async handleCron(): Promise<void> {
        if (this.running) {
            this.logger.warn('Visitor auto-checkout already in progress, skipping');
            return;
        }

        this.running = true;
        this.logger.log('Visitor auto-checkout job started');

        try {
            const result = await this.statusService.autoCheckOutExpiredVisitors();
            this.logger.log(`Visitor auto-checkout job completed — checked out: ${result.checkedOut}`);
        } catch (err) {
            this.logger.error('Visitor auto-checkout job failed unexpectedly', (err as Error).stack);
        } finally {
            this.running = false;
        }
    }

    isRunning(): boolean {
        return this.running;
    }
}
