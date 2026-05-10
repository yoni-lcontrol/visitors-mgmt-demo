import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AdSyncService, AdSyncResult } from './ad-sync.service';

export const AD_SYNC_QUEUE = 'ad-sync';

export interface AdSyncJobData {
    triggeredBy?: string;
}

@Processor(AD_SYNC_QUEUE, {
    concurrency: 1,
    limiter: { max: 1, duration: 5_000 },
})
export class AdSyncProcessor extends WorkerHost {
    private readonly logger = new Logger(AdSyncProcessor.name);

    constructor(private readonly adSyncService: AdSyncService) {
        super();
    }

    async process(job: Job<AdSyncJobData>): Promise<AdSyncResult> {
        this.logger.log(`Processing AD sync job ${job.id} (triggeredBy: ${job.data.triggeredBy ?? 'system'})`);

        try {
            const result = await this.adSyncService.syncAll(job.data.triggeredBy);

            this.logger.log(
                `AD sync job ${job.id} completed in ${result.durationMs}ms — ` +
                `created: ${result.totalCreated}, updated: ${result.totalUpdated}, ` +
                `deactivated: ${result.totalDeactivated}, failed: ${result.configsFailed}`,
            );

            return result;
        } catch (err) {
            this.logger.error(`AD sync job ${job.id} failed`, (err as Error).stack);
            throw err;
        }
    }
}
