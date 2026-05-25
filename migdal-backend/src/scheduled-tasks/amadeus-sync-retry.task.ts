import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AmadeusSyncQueueService } from '../amadeus/services/amadeus-sync-queue.service';

@Injectable()
export class AmadeusSyncRetryTask {
    private readonly logger = new Logger(AmadeusSyncRetryTask.name);

    constructor(private readonly syncQueue: AmadeusSyncQueueService) {}

    @Cron(CronExpression.EVERY_30_SECONDS, { name: 'amadeus-sync-retry' })
    async handleCron(): Promise<void> {
        const result = await this.syncQueue.processQueue();
        if (result.processed > 0) {
            this.logger.log(`Amadeus sync retry: processed=${result.processed}, succeeded=${result.succeeded}, failed=${result.failed}`);
        }
    }
}
