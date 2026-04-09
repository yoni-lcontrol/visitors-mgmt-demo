import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RetentionCleanupService } from '../settings/retention-cleanup.service';

@Injectable()
export class RetentionCleanupTask {
    private readonly logger = new Logger(RetentionCleanupTask.name);

    constructor(private readonly retentionCleanupService: RetentionCleanupService) { }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: 'retention-cleanup' })
    async handleCron(): Promise<void> {
        this.logger.log('Scheduled retention cleanup job started');

        try {
            await this.retentionCleanupService.handleRetentionCleanup();
            this.logger.log('Scheduled retention cleanup job completed');
        } catch (err) {
            this.logger.error('Scheduled retention cleanup job failed unexpectedly', (err as Error).stack);
        }
    }
}
